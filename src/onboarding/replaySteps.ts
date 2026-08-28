/**
 * The guided replay script: what "ChatGPT builds this board" looks like, step by step.
 *
 * Pure and deterministic. Every step names the tool a real agent would have called, the
 * sentence that call would have read back, and the immutable change it makes to the
 * workspace. The data is the same synthetic sample the seed button loads, so nothing
 * here can leak a real mailbox.
 */
import {
  DEMO_MONITOR_INVOICES,
  DEMO_MONITOR_TICKETS,
  sampleWorkspace,
} from "../demo/sampleWorkspace";
import type { Category, DraftAction, MonitorRun, Workspace } from "../types";

/** How long each kind of step stays on screen at speed 1. Exported so the tests can add up. */
export const REPLAY_PACING = {
  clear: 1600,
  category: 2000,
  summary: 1700,
  dashboard: 2600,
  overview: 3200,
  monitor: 2600,
  run: 2800,
  refusal: 2600,
} as const;

export interface ReplayStep {
  readonly id: string;
  /** One short sentence for the caption bar. */
  readonly caption: string;
  readonly tool: string;
  /** Audited exactly like a real call, so the rail and the toasts read the same. */
  readonly args: Readonly<Record<string, string | number>>;
  readonly result: string;
  readonly ok: boolean;
  readonly holdMs: number;
  apply(ws: Workspace): Workspace;
}

interface Tally {
  readonly auto: number;
  readonly pending: number;
  readonly held: number;
}

const money = (amount: number): string => `EUR ${amount.toLocaleString("en-US")}`;

function compact<T>(items: readonly (T | null | undefined)[]): readonly T[] {
  return items.filter((item): item is T => item !== null && item !== undefined);
}

/** Everything the agent built, gone. Keeps identity, mode and the audit trail. */
export function clearedWorkspace(ws: Workspace): Workspace {
  return {
    ...ws,
    categories: {},
    overview: undefined,
    monitors: {},
    runs: [],
    drafts: {},
    feedback: {},
  };
}

function putCategory(ws: Workspace, category: Category): Workspace {
  return { ...ws, categories: { ...ws.categories, [category.name]: category } };
}

function patchCategory(ws: Workspace, name: string, patch: Partial<Category>): Workspace {
  const current = ws.categories[name];
  if (!current) return ws;
  return putCategory(ws, { ...current, ...patch });
}

function tally(drafts: readonly DraftAction[]): Tally {
  return {
    auto: drafts.filter((draft) => draft.status === "auto").length,
    pending: drafts.filter((draft) => draft.status === "pending").length,
    held: drafts.filter((draft) => draft.status === "held").length,
  };
}

function tallyText(counts: Tally): string {
  const parts: string[] = [];
  if (counts.auto > 0) parts.push(`${counts.auto} auto approved`);
  if (counts.pending > 0) parts.push(`${counts.pending} pending`);
  if (counts.held > 0) parts.push(`${counts.held} held`);
  return parts.length > 0 ? parts.join(", ") : "nothing to do";
}

function clearStep(): ReplayStep {
  return {
    id: "clear",
    caption: "Starting from an empty board, the way your first visit looks.",
    tool: "clear_workspace",
    args: { confirm: "yes" },
    result: "Workspace cleared.",
    ok: true,
    holdMs: REPLAY_PACING.clear,
    apply: clearedWorkspace,
  };
}

function categoryStep(source: Category): ReplayStep {
  const bare: Category = {
    name: source.name,
    description: source.description,
    provenance: source.provenance,
    createdAt: source.createdAt,
  };
  return {
    id: `category:${source.name}`,
    caption: `ChatGPT created the category ${source.name}`,
    tool: "create_category",
    args: { name: source.name, provenance: source.provenance ?? "" },
    result: `Category ${source.name} ready.`,
    ok: true,
    holdMs: REPLAY_PACING.category,
    apply: (ws) => putCategory(ws, bare),
  };
}

function summaryStep(source: Category): ReplayStep | null {
  const summary = source.summary;
  if (!summary) return null;
  const rows = summary.rowCount ?? 0;
  const period = summary.period ?? "the period it read";
  return {
    id: `summary:${source.name}`,
    caption: `ChatGPT stored the aggregates for ${source.name}: ${rows} threads, ${period}`,
    tool: "upsert_dataset_summary",
    args: { category: source.name, rowCount: rows, period },
    result: `Aggregates stored for ${source.name}. No raw record crossed the boundary.`,
    ok: true,
    holdMs: REPLAY_PACING.summary,
    apply: (ws) => patchCategory(ws, source.name, { summary }),
  };
}

function dashboardStep(source: Category): ReplayStep | null {
  const dashboard = source.dashboard;
  if (!dashboard) return null;
  const kpis = dashboard.kpis.length;
  const charts = dashboard.charts.length;
  return {
    id: `dashboard:${source.name}`,
    caption: `ChatGPT built the ${source.name} dashboard: ${kpis} KPIs, ${charts} charts`,
    tool: "upsert_dashboard",
    args: { category: source.name, kpis, charts },
    result: `Dashboard for ${source.name} rendered with ${kpis} KPIs and ${charts} charts.`,
    ok: true,
    holdMs: REPLAY_PACING.dashboard,
    apply: (ws) => patchCategory(ws, source.name, { dashboard }),
  };
}

function overviewStep(sample: Workspace): ReplayStep | null {
  const overview = sample.overview;
  if (!overview) return null;
  const count = Object.keys(sample.categories).length;
  return {
    id: "overview",
    caption: `ChatGPT composed the overview across ${count} categories`,
    tool: "compose_overview",
    args: { title: overview.title, kpis: overview.kpis.length, charts: overview.charts.length },
    result: `Overview composed across ${count} categories.`,
    ok: true,
    holdMs: REPLAY_PACING.overview,
    apply: (ws) => ({ ...ws, overview }),
  };
}

function monitorStep(sample: Workspace, monitorId: string): ReplayStep | null {
  const source = sample.monitors[monitorId];
  if (!source) return null;
  const fresh = { ...source, lastRunAt: undefined };
  return {
    id: `monitor:${monitorId}`,
    caption: `ChatGPT registered the monitor ${source.name} on ${source.category}, ${source.schedule}`,
    tool: "register_monitor",
    args: { name: source.name, schedule: source.schedule, runner: source.runner },
    result: `Monitor registered. At most ${source.policy.maxAutoActionsPerRun} auto actions per run.`,
    ok: true,
    holdMs: REPLAY_PACING.monitor,
    apply: (ws) => ({ ...ws, monitors: { ...ws.monitors, [monitorId]: fresh } }),
  };
}

function applyRun(ws: Workspace, run: MonitorRun, drafts: readonly DraftAction[]): Workspace {
  const monitor = ws.monitors[run.monitorId];
  const monitors = monitor
    ? { ...ws.monitors, [run.monitorId]: { ...monitor, lastRunAt: run.finishedAt ?? run.startedAt } }
    : ws.monitors;
  const nextDrafts = drafts.reduce<Record<string, DraftAction>>(
    (acc, draft) => ({ ...acc, [draft.id]: draft }),
    { ...ws.drafts },
  );
  return { ...ws, monitors, runs: [...ws.runs, run], drafts: nextDrafts };
}

function runCaption(name: string, again: boolean, counts: Tally, clause: string | undefined): string {
  const head = `${name} ran${again ? " again" : ""}: ${tallyText(counts)}`;
  return clause ? `${head}, on the clause ${clause}` : head;
}

function runStep(sample: Workspace, runId: string, again: boolean): ReplayStep | null {
  const run = sample.runs.find((item) => item.id === runId);
  if (!run) return null;
  const drafts = compact(run.draftIds.map((id) => sample.drafts[id]));
  const counts = tally(drafts);
  const name = sample.monitors[run.monitorId]?.name ?? "A monitor";
  const clause = drafts.find((draft) => draft.status === "held")?.heldReason;
  return {
    id: `run:${runId}`,
    caption: runCaption(name, again, counts, clause),
    tool: "report_monitor_run",
    args: { monitorId: run.monitorId, findings: run.findings.length, drafts: drafts.length },
    result: `${counts.auto} auto, ${counts.pending} pending, ${counts.held} held.`,
    ok: true,
    holdMs: REPLAY_PACING.run,
    apply: (ws) => applyRun(ws, run, drafts),
  };
}

/** The agent tries to approve its own held draft. The policy says no, and says why. */
function refusalStep(sample: Workspace, draftId: string): ReplayStep | null {
  const draft = sample.drafts[draftId];
  if (!draft || !draft.heldReason) return null;
  const what = draft.amount === undefined ? draft.target : `a ${money(draft.amount)} invoice`;
  return {
    id: `refusal:${draftId}`,
    caption: `The policy held ${what}: ${draft.heldReason}`,
    tool: "approve_draft",
    args: { draftId },
    result: `Refused: clause ${draft.heldReason}. A human can approve it from the Monitors tab.`,
    ok: false,
    holdMs: REPLAY_PACING.refusal,
    apply: (ws) => ws,
  };
}

/**
 * The whole script, in order. Roughly 46 seconds at speed 1.
 * `now` is threaded through so the replay is deterministic in tests.
 */
export function buildReplaySteps(now: Date): readonly ReplayStep[] {
  const sample = sampleWorkspace(now);
  const categories = Object.values(sample.categories);
  return [
    clearStep(),
    ...categories.map(categoryStep),
    ...compact(categories.map(summaryStep)),
    ...compact(categories.map(dashboardStep)),
    ...compact([
      overviewStep(sample),
      monitorStep(sample, DEMO_MONITOR_INVOICES),
      monitorStep(sample, DEMO_MONITOR_TICKETS),
      runStep(sample, "run_tick_0001", false),
      runStep(sample, "run_inv_0001", false),
      refusalStep(sample, "draft_inv_001"),
      runStep(sample, "run_inv_0002", true),
    ]),
  ];
}

/** Total wall-clock length of the script at speed 1, in milliseconds. */
export function replayDurationMs(steps: readonly ReplayStep[]): number {
  return steps.reduce((total, step) => total + step.holdMs, 0);
}
