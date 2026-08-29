/**
 * Handlers A2 owns: the workspace and dashboard half of docs/TOOLS.md.
 * Each one is pure: it takes the validated input plus the current workspace and returns
 * the next workspace and the sentence the agent reads back. Sizes are clamped with the
 * A1 helpers (clampDashboard, clampOverview from src/dsl/validate) so the renderer and
 * the reply always agree.
 */

import { LIMITS, type Category, type Chart, type DashboardSpec, type DatasetSummary, type OverviewSpec, type TopItem, type Workspace } from "../types";
import { clampDashboard, clampOverview } from "../dsl/validate";
import { workspaceSummary } from "../store/selectors";
import { feedbackHandlers, openFeedbackLine } from "./feedbackTools";
import type { HandlerMap, ToolHandler } from "./registry";
import type {
  ClearWorkspaceInput,
  ComposeOverviewInput,
  CreateCategoryInput,
  GetDashboardInput,
  GetWorkspaceInput,
  UpsertDashboardInput,
  UpsertDatasetSummaryInput,
} from "./schemas";

const MAX_MAP_KEYS = 12;
const MAX_TOP_LISTS = 6;
const LIST_PREVIEW = 12;

const nowIso = (): string => new Date().toISOString();

const countLabel = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

function upsertCategory(ws: Workspace, name: string, patch: Partial<Category>): Workspace {
  const existing = ws.categories[name];
  const merged: Category = {
    name,
    createdAt: existing?.createdAt ?? nowIso(),
    description: patch.description ?? existing?.description,
    provenance: patch.provenance ?? existing?.provenance,
    summary: patch.summary ?? existing?.summary,
    dashboard: patch.dashboard ?? existing?.dashboard,
  };
  return { ...ws, categories: { ...ws.categories, [name]: merged } };
}

function atCategoryCap(ws: Workspace, name: string): boolean {
  return ws.categories[name] === undefined
    && Object.keys(ws.categories).length >= LIMITS.maxCategories;
}

const capText = `Refused: this workspace already holds ${LIMITS.maxCategories} categories. Reuse one or call clear_workspace first.`;

/** get_workspace answers must fit the budget left over after the feedback line. */
function summaryText(ws: Workspace, budget: number): string {
  const full = workspaceSummary(ws);
  const direct = JSON.stringify(full);
  if (direct.length <= budget) return direct;
  const lean = {
    ...full,
    categories: full.categories.slice(0, LIST_PREVIEW).map((item) => ({
      name: item.name,
      hasSummary: item.hasSummary,
      hasDashboard: item.hasDashboard,
    })),
    monitors: full.monitors.slice(0, LIST_PREVIEW),
    truncated: true,
  };
  const leanText = JSON.stringify(lean);
  if (leanText.length <= budget) return leanText;
  return JSON.stringify({
    mode: full.mode,
    categories: full.categories.length,
    hasOverview: full.hasOverview,
    monitors: full.monitors.length,
    pendingDrafts: full.pendingDrafts,
    heldDrafts: full.heldDrafts,
    truncated: true,
  });
}

/** get_dashboard drops detail in steps rather than returning half a JSON object. */
function dashboardText(spec: DashboardSpec): string {
  const direct = JSON.stringify(spec);
  if (direct.length <= LIMITS.toolOutputChars) return direct;
  const lean = {
    ...spec,
    notes: undefined,
    charts: spec.charts.map((chart) => ({ ...chart, rows: undefined, points: chart.points.slice(0, 6) })),
    truncated: true,
  };
  const leanText = JSON.stringify(lean);
  if (leanText.length <= LIMITS.toolOutputChars) return leanText;
  return JSON.stringify({
    category: spec.category,
    title: spec.title,
    kpis: spec.kpis,
    charts: spec.charts.map((chart) => ({ id: chart.id, kind: chart.kind, title: chart.title, points: chart.points.length })),
    updatedAt: spec.updatedAt,
    truncated: true,
  });
}

function clampNumberMap(map: Record<string, number> | undefined): Record<string, number> | undefined {
  if (map === undefined) return undefined;
  return Object.fromEntries(Object.entries(map).slice(0, MAX_MAP_KEYS));
}

function clampTop(
  top: Record<string, readonly TopItem[]> | undefined,
): Record<string, readonly TopItem[]> | undefined {
  if (top === undefined) return undefined;
  const entries = Object.entries(top)
    .slice(0, MAX_TOP_LISTS)
    .map(([key, items]) => [key, items.slice(0, LIMITS.maxPointsPerChart)] as const);
  return Object.fromEntries(entries);
}

function describeSummary(summary: DatasetSummary): string {
  const parts: string[] = [];
  if (summary.counts) parts.push(countLabel(Object.keys(summary.counts).length, "count"));
  if (summary.sums) parts.push(countLabel(Object.keys(summary.sums).length, "sum"));
  if (summary.top) parts.push(countLabel(Object.keys(summary.top).length, "top list"));
  if (typeof summary.rowCount === "number") parts.push(`${summary.rowCount} source rows`);
  if (summary.period) parts.push(`period ${summary.period}`);
  return parts.length > 0 ? parts.join(", ") : "no aggregates";
}

const getWorkspace: ToolHandler<GetWorkspaceInput> = (_input, ws) => {
  const tail = openFeedbackLine(ws);
  return { result: `${summaryText(ws, LIMITS.toolOutputChars - tail.length)}${tail}` };
};

const createCategory: ToolHandler<CreateCategoryInput> = (input, ws) => {
  if (atCategoryCap(ws, input.name)) return { result: capText };
  const next = upsertCategory(ws, input.name, {
    description: input.description,
    provenance: input.provenance,
  });
  return {
    next,
    result: `Category ${input.name} ready. Next: upsert_dataset_summary or upsert_dashboard.`,
  };
};

const upsertDatasetSummary: ToolHandler<UpsertDatasetSummaryInput> = (input, ws) => {
  if (atCategoryCap(ws, input.category)) return { result: capText };
  const summary: DatasetSummary = {
    counts: clampNumberMap(input.counts),
    sums: clampNumberMap(input.sums),
    top: clampTop(input.top),
    period: input.period,
    rowCount: input.rowCount,
    updatedAt: nowIso(),
  };
  const next = upsertCategory(ws, input.category, { summary });
  return {
    next,
    result: `Summary stored for ${input.category}: ${describeSummary(summary)}. Aggregates only, no rows were kept.`,
  };
};

const upsertDashboard: ToolHandler<UpsertDashboardInput> = (input, ws) => {
  if (atCategoryCap(ws, input.category)) return { result: capText };
  const dashboard = clampDashboard({
    category: input.category,
    title: input.title ?? input.category,
    kpis: input.kpis,
    charts: (input.charts ?? []) as readonly Chart[],
    notes: input.notes,
    source: input.source,
    updatedAt: nowIso(),
  });
  const next = upsertCategory(ws, input.category, { dashboard });
  const dropped = (input.charts?.length ?? 0) - dashboard.charts.length + (input.kpis.length - dashboard.kpis.length);
  const tail = dropped > 0 ? ` ${dropped} item(s) over the limit were dropped.` : "";
  return {
    next,
    result: `Dashboard for ${input.category} rendered with ${dashboard.kpis.length} KPIs and ${dashboard.charts.length} charts.${tail}`,
  };
};

const getDashboard: ToolHandler<GetDashboardInput> = (input, ws) => {
  const dashboard = ws.categories[input.category]?.dashboard;
  if (dashboard === undefined) {
    return {
      result: `No dashboard for ${input.category} yet. Call upsert_dashboard with kpis and optional charts to create one.`,
    };
  }
  return { result: dashboardText(dashboard) };
};

const composeOverview: ToolHandler<ComposeOverviewInput> = (input, ws) => {
  const overview: OverviewSpec = clampOverview({
    title: input.title,
    kpis: input.kpis,
    charts: (input.charts ?? []) as readonly Chart[],
    highlights: input.highlights,
    updatedAt: nowIso(),
  });
  return {
    next: { ...ws, overview },
    result: `Overview "${overview.title}" composed with ${overview.kpis.length} KPIs and ${overview.charts.length} charts. It is the first tab visitors see.`,
  };
};

const clearWorkspace: ToolHandler<ClearWorkspaceInput> = (_input, ws) => {
  const removed = [
    countLabel(Object.keys(ws.categories).length, "category", "categories"),
    countLabel(Object.keys(ws.monitors).length, "monitor"),
    countLabel(Object.keys(ws.drafts).length, "draft"),
  ].join(", ");
  const next: Workspace = {
    ...ws,
    categories: {},
    overview: undefined,
    monitors: {},
    runs: [],
    drafts: {},
  };
  return { next, result: `Workspace cleared: ${removed} removed. The audit trail was kept.` };
};

/** The workspace, dashboard and feedback tools. A3 and A5 spread their maps on top. */
export const workspaceHandlers: HandlerMap = {
  ...feedbackHandlers,
  get_workspace: getWorkspace,
  create_category: createCategory,
  upsert_dataset_summary: upsertDatasetSummary,
  upsert_dashboard: upsertDashboard,
  get_dashboard: getDashboard,
  compose_overview: composeOverview,
  clear_workspace: clearWorkspace,
};
