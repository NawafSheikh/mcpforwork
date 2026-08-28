/**
 * Human-side view options for one chart: draw the same points as a bar, a line
 * or a donut, and sort them by value or by label. Pure: nothing here touches the
 * stored spec, so a human can look at the data differently without editing it.
 */

import type { Chart, ChartKind, ChartPoint } from "../../types";

export type SortMode = "none" | "value" | "label";

/** Kinds a human may switch between without changing the data. */
export const SWITCHABLE_KINDS: readonly ChartKind[] = ["bar", "line", "donut"];

export interface ChartView {
  readonly kind?: ChartKind;
  readonly sort?: SortMode;
}

export const DEFAULT_VIEW: ChartView = {};

type Row = readonly (string | number)[];

/** True when the chart carries points, so another kind can draw the same data. */
export function canSwitchKind(chart: Chart): boolean {
  return (chart.points ?? []).length > 0;
}

/** True when a sort toggle makes sense: ordered marks or table rows. */
export function canSort(chart: Chart, kind: ChartKind): boolean {
  if (kind === "table") return (chart.rows ?? []).length > 0 || (chart.points ?? []).length > 0;
  return (chart.points ?? []).length > 1;
}

/** Descending by value, ascending by label, or the agent's own order. */
export function sortPoints(points: readonly ChartPoint[], mode: SortMode): readonly ChartPoint[] {
  const source = points ?? [];
  if (mode === "value") return [...source].sort((a, b) => b.value - a.value);
  if (mode === "label") return [...source].sort((a, b) => a.label.localeCompare(b.label));
  return source;
}

/** Same rule for table rows: first column is the label, first number is the value. */
export function sortRows(rows: readonly Row[], mode: SortMode): readonly Row[] {
  const source = rows ?? [];
  if (mode === "none" || source.length < 2) return source;
  const index = mode === "value" ? numericColumn(source) : 0;
  if (index < 0) return source;
  return [...source].sort((a, b) => compareCells(a[index], b[index], mode));
}

/** The chart a renderer should draw for this view. Never mutates the input. */
export function applyChartView(chart: Chart, view: ChartView): Chart {
  const kind = view.kind ?? chart.kind;
  const sort = view.sort ?? "none";
  if (kind === chart.kind && sort === "none") return chart;
  return {
    ...chart,
    kind,
    points: sortPoints(chart.points ?? [], sort),
    rows: chart.rows ? sortRows(chart.rows, sort) : chart.rows,
  };
}

function numericColumn(rows: readonly Row[]): number {
  const first = rows[0] ?? [];
  for (let index = 0; index < first.length; index += 1) {
    if (typeof first[index] === "number") return index;
  }
  return -1;
}

function compareCells(a: Row[number] | undefined, b: Row[number] | undefined, mode: SortMode): number {
  if (typeof a === "number" && typeof b === "number") return mode === "value" ? b - a : a - b;
  return String(a ?? "").localeCompare(String(b ?? ""));
}
