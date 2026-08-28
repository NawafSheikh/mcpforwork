/**
 * Pure reducers for human edits to a spec: rename the title, reorder a chart,
 * delete one, put one back. No React, no store, no clock: every function takes
 * what it needs and returns a new object, so the shell can undo by calling the
 * opposite function with the value it kept.
 */

import type { Chart, DashboardSpec, OverviewSpec } from "../types";

/** Fall back to the category name when a human clears the title field. */
export function renameDashboard(spec: DashboardSpec, title: string, at: string): DashboardSpec {
  const trimmed = title.trim();
  return { ...spec, title: trimmed === "" ? spec.category : trimmed, updatedAt: at };
}

/** The overview has no fallback name, so an empty title keeps the old one. */
export function renameOverview(spec: OverviewSpec, title: string, at: string): OverviewSpec {
  const trimmed = title.trim();
  return trimmed === "" ? spec : { ...spec, title: trimmed, updatedAt: at };
}

/** Move one chart by delta places. Out of range moves are a no-op. */
export function moveChart(charts: readonly Chart[], index: number, delta: number): readonly Chart[] {
  const target = index + delta;
  if (!inRange(charts, index) || !inRange(charts, target)) return charts;
  const next = [...charts];
  const moved = next[index];
  const displaced = next[target];
  if (moved === undefined || displaced === undefined) return charts;
  next[index] = displaced;
  next[target] = moved;
  return next;
}

/** Drop one chart. Returns the same array when the index is out of range. */
export function removeChart(charts: readonly Chart[], index: number): readonly Chart[] {
  if (!inRange(charts, index)) return charts;
  return charts.filter((_chart, at) => at !== index);
}

/** Put a chart back at a position, clamped to the ends of the list. */
export function insertChart(charts: readonly Chart[], index: number, chart: Chart): readonly Chart[] {
  const at = Math.min(Math.max(0, index), charts.length);
  return [...charts.slice(0, at), chart, ...charts.slice(at)];
}

/** Swap one chart for an edited copy, for example after a kind change is kept. */
export function replaceChart(charts: readonly Chart[], index: number, chart: Chart): readonly Chart[] {
  if (!inRange(charts, index)) return charts;
  return charts.map((current, at) => (at === index ? chart : current));
}

export function setDashboardCharts(
  spec: DashboardSpec,
  charts: readonly Chart[],
  at: string,
): DashboardSpec {
  return { ...spec, charts, updatedAt: at };
}

export function setOverviewCharts(
  spec: OverviewSpec,
  charts: readonly Chart[],
  at: string,
): OverviewSpec {
  return { ...spec, charts, updatedAt: at };
}

function inRange(charts: readonly Chart[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < charts.length;
}
