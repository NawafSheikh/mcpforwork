/**
 * Aggregation (owner A11): the tool that lets an agent build a real chart from data
 * it is never allowed to read. One filtered pass, one Map of group accumulators, then
 * the top N points with masked labels.
 *
 * A group built from a single row is that row, so groups under DATASET_LIMITS.minLabelCount
 * are dropped and counted in `hidden`. Nothing here returns a row, a row id or an
 * unmasked string beyond a group label.
 */

import { isBlank, toNumber } from "./infer";
import { maskLabel } from "./mask";
import { LIMITS } from "../types";
import {
  DATASET_LIMITS,
  type AggregatePoint,
  type AggregateResult,
  type CellValue,
  type DatasetTable,
  type FilterOp,
  type MetricOp,
} from "./types";

export interface AggregateFilter {
  readonly column: string;
  readonly op: FilterOp;
  readonly value: string | number | boolean;
}

export interface AggregateQuery {
  readonly groupBy: string;
  readonly metric: { readonly column: string; readonly op: MetricOp };
  readonly top?: number;
  readonly filter?: AggregateFilter;
}

export class AggregateError extends Error {}

interface GroupAcc {
  count: number;
  sum: number;
  min: number;
  max: number;
}

const newGroup = (): GroupAcc => ({
  count: 0,
  sum: 0,
  min: Number.POSITIVE_INFINITY,
  max: Number.NEGATIVE_INFINITY,
});

function indexOfColumn(table: DatasetTable, name: string, role: string): number {
  const index = table.columns.indexOf(name);
  if (index === -1) {
    throw new AggregateError(
      `Unknown ${role} column "${name}". Call get_dataset_profile to see the column names.`,
    );
  }
  return index;
}

/** eq and contains compare as text; gt and lt compare as numbers when both sides are. */
export function passesFilter(cell: CellValue, op: FilterOp, target: string | number | boolean): boolean {
  const cellText = cell === null ? "" : String(cell).trim().toLowerCase();
  const targetText = String(target).trim().toLowerCase();
  if (op === "eq") return cellText === targetText;
  if (op === "neq") return cellText !== targetText;
  if (op === "contains") return targetText.length > 0 && cellText.includes(targetText);
  const right = typeof target === "number" ? target : toNumber(String(target));
  if (right === null) {
    // Both sides are text: ISO dates and names still order sensibly.
    return op === "gt" ? cellText > targetText : cellText < targetText;
  }
  const left = toNumber(cell);
  // A cell that is not a number is not greater than 150, and not less than it either.
  if (left === null) return false;
  return op === "gt" ? left > right : left < right;
}

function accumulate(group: GroupAcc, op: MetricOp, cell: CellValue): boolean {
  if (op === "count") {
    if (isBlank(cell)) return false;
    group.count += 1;
    return true;
  }
  const value = toNumber(cell);
  if (value === null) return false;
  group.count += 1;
  group.sum += value;
  if (value < group.min) group.min = value;
  if (value > group.max) group.max = value;
  return true;
}

function readGroup(group: GroupAcc, op: MetricOp): number {
  if (op === "count") return group.count;
  if (op === "sum") return round(group.sum);
  if (op === "mean") return group.count === 0 ? 0 : round(group.sum / group.count);
  if (op === "min") return group.min === Number.POSITIVE_INFINITY ? 0 : group.min;
  return group.max === Number.NEGATIVE_INFINITY ? 0 : group.max;
}

const round = (value: number): number => Math.round(value * 10000) / 10000;

/** min sorts ascending (smallest first is the interesting end); everything else descending. */
function sortPoints(points: AggregatePoint[], op: MetricOp): AggregatePoint[] {
  const direction = op === "min" ? 1 : -1;
  return points.sort((a, b) => direction * (a.value - b.value) || a.label.localeCompare(b.label));
}

export function aggregateTable(table: DatasetTable, query: AggregateQuery): AggregateResult {
  const groupIndex = indexOfColumn(table, query.groupBy, "groupBy");
  const metricIndex = indexOfColumn(table, query.metric.column, "metric");
  const filterIndex = query.filter ? indexOfColumn(table, query.filter.column, "filter") : -1;
  const groups = new Map<string, GroupAcc>();
  let matched = 0;
  let skipped = 0;

  for (let r = 0; r < table.rows.length; r += 1) {
    const row = table.rows[r] as readonly CellValue[];
    if (query.filter && !passesFilter(row[filterIndex] ?? null, query.filter.op, query.filter.value)) {
      continue;
    }
    matched += 1;
    const key = keyOf(row[groupIndex] ?? null);
    let group = groups.get(key);
    if (group === undefined) {
      group = newGroup();
      groups.set(key, group);
    }
    if (!accumulate(group, query.metric.op, row[metricIndex] ?? null)) skipped += 1;
  }

  const cap = Math.min(query.top ?? LIMITS.maxPointsPerChart, LIMITS.maxPointsPerChart);
  const large = [...groups.entries()].filter(
    ([, group]) => group.count >= DATASET_LIMITS.minLabelCount,
  );
  const points = sortPoints(
    large.map(([label, group]) => ({
      label: maskLabel(label),
      value: readGroup(group, query.metric.op),
    })),
    query.metric.op,
  ).slice(0, cap);

  return { points, groups: groups.size, matched, skipped, hidden: groups.size - large.length };
}

/** Every flavour of blank groups together, and stray whitespace does not split a category. */
const keyOf = (cell: CellValue): string => (isBlank(cell) ? "" : String(cell).trim());
