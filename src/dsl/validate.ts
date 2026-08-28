/**
 * Pure guards for the dashboard DSL. The agent is never trusted with sizes:
 * every spec is clamped to LIMITS before it reaches a renderer or a tool reply.
 * Nothing here mutates its input; every helper returns a new object.
 */

import type { Chart, DashboardSpec, KPI, OverviewSpec } from "../types";
import { LIMITS } from "../types";
import { formatClock } from "./format";

/** The overview carries a wider KPI row than a single category dashboard. */
export const OVERVIEW_KPI_LIMIT = 6;
export const MAX_NOTES = 6;
export const MAX_HIGHLIGHTS = 6;
export const MAX_TABLE_COLUMNS = 8;

type Row = readonly (string | number)[];

/** Stable id for a chart, so onEdit always has something to name. */
export function chartKey(chart: Chart, index: number): string {
  const id = chart.id?.trim();
  return id ? id : `chart-${index}`;
}

/** Truncate points, columns and table rows. Never pads, never reorders. */
export function clampChart(chart: Chart): Chart {
  const columns = chart.columns ? chart.columns.slice(0, MAX_TABLE_COLUMNS) : undefined;
  return {
    ...chart,
    points: (chart.points ?? []).slice(0, LIMITS.maxPointsPerChart),
    columns,
    rows: chart.rows ? clampRows(chart.rows, columns?.length) : undefined,
  };
}

export function clampCharts(charts: readonly Chart[]): readonly Chart[] {
  return (charts ?? []).slice(0, LIMITS.maxCharts).map(clampChart);
}

export function clampKpis(kpis: readonly KPI[], max: number): readonly KPI[] {
  return (kpis ?? []).slice(0, max);
}

export function clampDashboard(spec: DashboardSpec): DashboardSpec {
  return {
    ...spec,
    kpis: clampKpis(spec.kpis, LIMITS.maxKpis),
    charts: clampCharts(spec.charts),
    notes: spec.notes ? spec.notes.slice(0, MAX_NOTES) : undefined,
  };
}

export function clampOverview(spec: OverviewSpec): OverviewSpec {
  return {
    ...spec,
    kpis: clampKpis(spec.kpis, OVERVIEW_KPI_LIMIT),
    charts: clampCharts(spec.charts),
    highlights: spec.highlights ? spec.highlights.slice(0, MAX_HIGHLIGHTS) : undefined,
  };
}

/** One line for a tool reply: "4 KPIs, 2 charts (bar, table), updated 12:04". */
export function describeDashboard(spec: DashboardSpec): string {
  return describeParts(spec.kpis, spec.charts, spec.updatedAt);
}

export function describeOverview(spec: OverviewSpec): string {
  return describeParts(spec.kpis, spec.charts, spec.updatedAt);
}

function describeParts(
  kpis: readonly KPI[] | undefined,
  charts: readonly Chart[] | undefined,
  updatedAt: string,
): string {
  const parts = [countLabel(kpis?.length ?? 0, "KPI"), chartLabel(charts ?? [])];
  const clock = formatClock(updatedAt);
  return (clock ? [...parts, `updated ${clock}`] : parts).join(", ");
}

function chartLabel(charts: readonly Chart[]): string {
  const base = countLabel(charts.length, "chart");
  if (charts.length === 0) return base;
  const kinds = Array.from(new Set(charts.map((chart) => chart.kind)));
  return `${base} (${kinds.join(", ")})`;
}

function countLabel(count: number, noun: string): string {
  if (count === 0) return `no ${noun}s`;
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function clampRows(rows: readonly Row[], width?: number): readonly Row[] {
  const capped = rows.slice(0, LIMITS.maxTableRows);
  if (width === undefined) return capped;
  return capped.map((row) => (row.length > width ? row.slice(0, width) : row));
}
