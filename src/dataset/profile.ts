/**
 * Profiling (owner A11): one pass over the table, one accumulator per column.
 *
 * The accumulators below are mutated inside the loop on purpose. They are born and
 * die inside profileTable, are never shared and never observed, and a 100k row file
 * cannot afford a new object per cell. Everything this function returns is frozen in
 * shape and masked: profileTable is the boundary where raw cells stop.
 */

import {
  emptyTally,
  isBlank,
  toBoolean,
  toNumber,
  toTimestamp,
  typeFromTally,
  type TypeTally,
} from "./infer";
import { cellHasEmail, maskLabel, maskSample } from "./mask";
import {
  DATASET_LIMITS,
  type CellValue,
  type ColumnProfile,
  type ColumnType,
  type DatasetProfile,
  type DatasetTable,
  type MaskedRow,
  type ValueCount,
} from "./types";

/** Distinct values tracked per column before we stop counting and say "5000+". */
const CARDINALITY_CAP = 5000;

interface ColumnAcc {
  readonly name: string;
  readonly tally: TypeTally;
  readonly counts: Map<string, number>;
  capped: boolean;
  blanks: number;
  emails: boolean;
  numFilled: number;
  sum: number;
  min: number;
  max: number;
  minTs: number;
  maxTs: number;
}

const createAcc = (name: string): ColumnAcc => ({
  name,
  tally: emptyTally(),
  counts: new Map<string, number>(),
  capped: false,
  blanks: 0,
  emails: false,
  numFilled: 0,
  sum: 0,
  min: Number.POSITIVE_INFINITY,
  max: Number.NEGATIVE_INFINITY,
  minTs: Number.POSITIVE_INFINITY,
  maxTs: Number.NEGATIVE_INFINITY,
});

/** Date first, then number, then boolean: "2026-01-02" must not be read as arithmetic. */
function observeShape(acc: ColumnAcc, value: CellValue): void {
  const ts = toTimestamp(value);
  if (ts !== null) {
    acc.tally.dates += 1;
    if (ts < acc.minTs) acc.minTs = ts;
    if (ts > acc.maxTs) acc.maxTs = ts;
    return;
  }
  const num = toNumber(value);
  if (num !== null) {
    acc.tally.numbers += 1;
    acc.numFilled += 1;
    acc.sum += num;
    if (num < acc.min) acc.min = num;
    if (num > acc.max) acc.max = num;
  }
  if (toBoolean(value) !== null) acc.tally.booleans += 1;
}

function observe(acc: ColumnAcc, value: CellValue): void {
  if (isBlank(value)) {
    acc.blanks += 1;
    return;
  }
  acc.tally.filled += 1;
  observeShape(acc, value);
  if (!acc.emails && typeof value === "string" && value.indexOf("@") !== -1) {
    acc.emails = cellHasEmail(value);
  }
  countValue(acc, typeof value === "string" ? value : String(value));
}

function countValue(acc: ColumnAcc, key: string): void {
  const seen = acc.counts.get(key);
  if (seen !== undefined) {
    acc.counts.set(key, seen + 1);
    return;
  }
  if (acc.counts.size >= CARDINALITY_CAP) {
    acc.capped = true;
    return;
  }
  acc.counts.set(key, 1);
}

/**
 * Top 8, masked, and only when the column reads as a category rather than an identifier.
 * A value that appears exactly once is never listed: at a count of one, the "aggregate"
 * is the row. Emails are withheld whole, whatever their cardinality.
 */
function topValues(acc: ColumnAcc, type: ColumnType): Pick<ColumnProfile, "top" | "topWithheld"> {
  if (acc.emails) return { topWithheld: "emails" };
  if (type === "number" || type === "date" || type === "empty") return {};
  if (acc.capped || acc.counts.size > DATASET_LIMITS.categoricalMax) {
    return { topWithheld: "high-cardinality" };
  }
  const repeated = [...acc.counts.entries()].filter(
    ([, count]) => count >= DATASET_LIMITS.minLabelCount,
  );
  if (repeated.length === 0) return { topWithheld: "high-cardinality" };
  const top: ValueCount[] = repeated
    .sort(byCountThenLabel)
    .slice(0, DATASET_LIMITS.topValues)
    .map(([label, count]) => ({ label: maskLabel(label), count }));
  return { top };
}

const byCountThenLabel = (a: readonly [string, number], b: readonly [string, number]): number =>
  b[1] - a[1] || a[0].localeCompare(b[0]);

const isoDay = (ts: number): string => new Date(ts).toISOString().slice(0, 10);

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

function finishColumn(acc: ColumnAcc, rowCount: number): ColumnProfile {
  const type = typeFromTally(acc.tally);
  const base: ColumnProfile = {
    name: acc.name,
    type,
    nullRate: rowCount === 0 ? 0 : round4(acc.blanks / rowCount),
    cardinality: acc.counts.size,
    ...(acc.capped ? { cardinalityAtLeast: true } : {}),
    ...(acc.emails ? { hasEmails: true } : {}),
    ...topValues(acc, type),
  };
  const numeric =
    type === "number" && acc.numFilled > 0
      ? {
          numeric: {
            min: acc.min,
            max: acc.max,
            mean: round4(acc.sum / acc.numFilled),
            sum: round4(acc.sum),
          },
        }
      : {};
  const dates =
    type === "date" && acc.minTs !== Number.POSITIVE_INFINITY
      ? { dateRange: { min: isoDay(acc.minTs), max: isoDay(acc.maxTs) } }
      : {};
  return { ...base, ...numeric, ...dates };
}

/** Three rows, every value replaced by a shape token. Column names are not masked. */
export function maskedSample(
  table: DatasetTable,
  columns: readonly ColumnProfile[],
): readonly MaskedRow[] {
  const rows = table.rows.slice(0, DATASET_LIMITS.sampleRows);
  return rows.map((row) => {
    const pairs = columns.map((column, index): readonly [string, string] => [
      column.name,
      maskSample(row[index] ?? null, column.type),
    ]);
    return Object.fromEntries(pairs) as MaskedRow;
  });
}

export interface ProfileOptions {
  readonly id: string;
  readonly name: string;
  readonly bytes: number;
  readonly now?: () => Date;
}

/** The one function that turns raw cells into something an agent may read. */
export function profileTable(table: DatasetTable, options: ProfileOptions): DatasetProfile {
  const accs = table.columns.map(createAcc);
  const width = accs.length;
  for (let r = 0; r < table.rows.length; r += 1) {
    const row = table.rows[r] as readonly CellValue[];
    for (let c = 0; c < width; c += 1) {
      observe(accs[c] as ColumnAcc, row[c] ?? null);
    }
  }
  const columns = accs.map((acc) => finishColumn(acc, table.rows.length));
  const at = (options.now ?? (() => new Date()))();
  return {
    id: options.id,
    name: options.name,
    rowCount: table.rows.length,
    bytes: options.bytes,
    columns,
    sample: maskedSample(table, columns),
    profiledAt: at.toISOString(),
  };
}

/** The widest date range in the file, used as the period on a DatasetSummary. */
export function profilePeriod(profile: DatasetProfile): string | undefined {
  const ranges = profile.columns.flatMap((column) => (column.dateRange ? [column.dateRange] : []));
  if (ranges.length === 0) return undefined;
  const min = ranges.reduce((low, range) => (range.min < low ? range.min : low), ranges[0]?.min ?? "");
  const max = ranges.reduce((high, range) => (range.max > high ? range.max : high), ranges[0]?.max ?? "");
  return `${min} to ${max}`;
}

export const columnByName = (
  profile: DatasetProfile,
  name: string,
): ColumnProfile | undefined => profile.columns.find((column) => column.name === name);
