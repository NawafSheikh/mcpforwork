/**
 * Profile to DatasetSummary (owner A11).
 *
 * attach_dataset_to_category stores this, and only this, on the board. Every number
 * here is an aggregate the profiler already computed: sums of numeric columns, distinct
 * counts of categorical ones, masked top lists, the widest date range as the period.
 * No cell of the file survives the trip except a top-8 label, which is capped at 40
 * characters and never an email address.
 */

import { LIMITS, type DatasetSummary, type TopItem } from "../types";
import { profilePeriod } from "./profile";
import { provenanceFor, type ColumnProfile, type DatasetProfile, type ValueCount } from "./types";

const MAX_SUM_COLUMNS = 4;
const MAX_COUNT_COLUMNS = 4;
const MAX_TOP_LISTS = 3;

const isNumeric = (column: ColumnProfile): boolean => column.numeric !== undefined;

const hasTop = (column: ColumnProfile): column is ColumnProfile & { top: readonly ValueCount[] } =>
  column.top !== undefined && column.top.length > 0;

function sumsOf(profile: DatasetProfile): Record<string, number> | undefined {
  const numeric = profile.columns.filter(isNumeric).slice(0, MAX_SUM_COLUMNS);
  if (numeric.length === 0) return undefined;
  return Object.fromEntries(numeric.map((column) => [column.name, column.numeric?.sum ?? 0]));
}

function countsOf(profile: DatasetProfile): Record<string, number> | undefined {
  // Dates are covered by the period, numbers by the sums; this is the categorical half.
  const categorical = profile.columns
    .filter((column) => column.type === "text" || column.type === "boolean")
    .slice(0, MAX_COUNT_COLUMNS);
  if (categorical.length === 0) return undefined;
  return Object.fromEntries(
    categorical.map((column) => [`${column.name} distinct`, column.cardinality]),
  );
}

function topOf(profile: DatasetProfile): Record<string, readonly TopItem[]> | undefined {
  const lists = profile.columns.filter(hasTop).slice(0, MAX_TOP_LISTS);
  if (lists.length === 0) return undefined;
  return Object.fromEntries(
    lists.map((column) => [
      column.name,
      column.top
        .slice(0, LIMITS.maxPointsPerChart)
        .map((item): TopItem => ({ label: item.label, value: item.count })),
    ]),
  );
}

/** Honest mapping: nothing invented, nothing rounded up, blanks left out. */
export function summaryFromProfile(profile: DatasetProfile): DatasetSummary {
  return {
    counts: countsOf(profile),
    sums: sumsOf(profile),
    top: topOf(profile),
    period: profilePeriod(profile),
    rowCount: profile.rowCount,
    updatedAt: profile.profiledAt,
  };
}

export const summaryProvenance = (profile: DatasetProfile): string => provenanceFor(profile.name);

/** One sentence back to the agent describing exactly what was stored. */
export function describeStored(summary: DatasetSummary): string {
  const parts = [
    summary.sums ? `${Object.keys(summary.sums).length} column sums` : undefined,
    summary.counts ? `${Object.keys(summary.counts).length} distinct counts` : undefined,
    summary.top ? `${Object.keys(summary.top).length} top lists` : undefined,
    summary.period ? `period ${summary.period}` : undefined,
  ].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join(", ") : "row count only";
}
