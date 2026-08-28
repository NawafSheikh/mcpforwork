/**
 * Pure workspace transforms behind every human edit on the board.
 * Each one takes a Workspace and returns a new Workspace: no store, no clock,
 * no React. The hook in useBoardEdits.ts supplies the timestamp and the audit.
 */

import {
  insertChart,
  moveChart,
  removeChart,
  renameDashboard,
  renameOverview,
  replaceChart,
  setDashboardCharts,
  setOverviewCharts,
} from "../../../dsl";
import type { Chart, DashboardSpec, OverviewSpec, Workspace } from "../../../types";

export type EditTarget =
  | { readonly kind: "dashboard"; readonly category: string }
  | { readonly kind: "overview" };

/** Human readable name of the target, for audit lines and toasts. */
export function targetLabel(target: EditTarget): string {
  return target.kind === "overview" ? "the overview" : target.category;
}

/** Replace one category dashboard. A category with no dashboard is left alone. */
export function mapDashboard(
  ws: Workspace,
  category: string,
  fn: (spec: DashboardSpec) => DashboardSpec,
): Workspace {
  const current = ws.categories[category];
  if (!current?.dashboard) return ws;
  const next = { ...current, dashboard: fn(current.dashboard) };
  return { ...ws, categories: { ...ws.categories, [category]: next } };
}

export function mapOverview(ws: Workspace, fn: (spec: OverviewSpec) => OverviewSpec): Workspace {
  if (!ws.overview) return ws;
  return { ...ws, overview: fn(ws.overview) };
}

/** Charts currently on the target, or an empty list when it does not exist. */
export function chartsOf(ws: Workspace, target: EditTarget): readonly Chart[] {
  if (target.kind === "overview") return ws.overview?.charts ?? [];
  return ws.categories[target.category]?.dashboard?.charts ?? [];
}

/** One chart by index, or undefined when the index is out of range. */
export function chartAt(ws: Workspace, target: EditTarget, index: number): Chart | undefined {
  return chartsOf(ws, target)[index];
}

function withCharts(
  ws: Workspace,
  target: EditTarget,
  fn: (charts: readonly Chart[]) => readonly Chart[],
  at: string,
): Workspace {
  if (target.kind === "overview") {
    return mapOverview(ws, (spec) => setOverviewCharts(spec, fn(spec.charts), at));
  }
  return mapDashboard(ws, target.category, (spec) => setDashboardCharts(spec, fn(spec.charts), at));
}

export function applyRename(ws: Workspace, target: EditTarget, title: string, at: string): Workspace {
  if (target.kind === "overview") return mapOverview(ws, (spec) => renameOverview(spec, title, at));
  return mapDashboard(ws, target.category, (spec) => renameDashboard(spec, title, at));
}

export function applyMove(
  ws: Workspace,
  target: EditTarget,
  index: number,
  delta: number,
  at: string,
): Workspace {
  return withCharts(ws, target, (charts) => moveChart(charts, index, delta), at);
}

export function applyRemove(ws: Workspace, target: EditTarget, index: number, at: string): Workspace {
  return withCharts(ws, target, (charts) => removeChart(charts, index), at);
}

export function applyInsert(
  ws: Workspace,
  target: EditTarget,
  index: number,
  chart: Chart,
  at: string,
): Workspace {
  return withCharts(ws, target, (charts) => insertChart(charts, index, chart), at);
}

export function applyReplace(
  ws: Workspace,
  target: EditTarget,
  index: number,
  chart: Chart,
  at: string,
): Workspace {
  return withCharts(ws, target, (charts) => replaceChart(charts, index, chart), at);
}
