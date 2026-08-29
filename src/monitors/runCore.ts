/**
 * The one path a monitor run takes, whether the findings came from a real
 * agent (report_monitor_run). Every draft goes
 * through the policy engine in order, and the auto counter carries forward so
 * maxAutoActionsPerRun is enforced across the whole run.
 */

import { evaluateDraft, type DraftCandidate } from "../policy/engine";
import { LIMITS } from "../types";
import type {
  AuditEvent,
  DraftAction,
  Monitor,
  MonitorRun,
  Workspace,
} from "../types";
import { nextRunFromText } from "./schedule";

/** Runs kept in the workspace. Older runs and their drafts are dropped. */
export const MAX_RUNS = 50;

export interface RunCounts {
  readonly auto: number;
  readonly pending: number;
  readonly held: number;
}

export interface AppliedRun {
  readonly next: Workspace;
  readonly run: MonitorRun;
  readonly drafts: readonly DraftAction[];
  readonly counts: RunCounts;
}

export function nextRunId(ws: Workspace): string {
  const used = new Set(ws.runs.map((run) => run.id));
  let index = ws.runs.length + 1;
  while (used.has(`run-${index}`)) {
    index += 1;
  }
  return `run-${index}`;
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug === "" ? "monitor" : slug;
}

export function nextMonitorId(ws: Workspace, name: string): string {
  const base = `mon-${slugify(name)}`;
  if (ws.monitors[base] === undefined) {
    return base;
  }
  let index = 2;
  while (ws.monitors[`${base}-${index}`] !== undefined) {
    index += 1;
  }
  return `${base}-${index}`;
}

interface DraftFold {
  readonly drafts: readonly DraftAction[];
  readonly autos: number;
}

function buildDraft(
  candidate: DraftCandidate,
  ids: { runId: string; monitorId: string; draftId: string },
  autosSoFar: number,
  monitor: Monitor,
  at: string,
): DraftAction {
  const decision = evaluateDraft(monitor.policy, candidate, {
    autoApprovedSoFar: autosSoFar,
  });
  return {
    id: ids.draftId,
    monitorId: ids.monitorId,
    runId: ids.runId,
    kind: candidate.kind,
    target: candidate.target,
    summary: candidate.summary,
    ...(candidate.amount !== undefined ? { amount: candidate.amount } : {}),
    ...(candidate.fields !== undefined ? { fields: candidate.fields } : {}),
    status: decision.status,
    ...(decision.status === "held"
      ? { heldReason: decision.clause ?? "held" }
      : {}),
    ...(decision.status === "auto"
      ? { decidedBy: "policy" as const, decidedAt: at }
      : {}),
  };
}

function foldDrafts(
  monitor: Monitor,
  candidates: readonly DraftCandidate[],
  runId: string,
  at: string,
): DraftFold {
  return candidates.reduce<DraftFold>(
    (acc, candidate, index) => {
      const draft = buildDraft(
        candidate,
        {
          runId,
          monitorId: monitor.id,
          draftId: `${runId}-d${index + 1}`,
        },
        acc.autos,
        monitor,
        at,
      );
      return {
        drafts: [...acc.drafts, draft],
        autos: acc.autos + (draft.status === "auto" ? 1 : 0),
      };
    },
    { drafts: [], autos: 0 },
  );
}

export function countStatuses(drafts: readonly DraftAction[]): RunCounts {
  return {
    auto: drafts.filter((draft) => draft.status === "auto").length,
    pending: drafts.filter((draft) => draft.status === "pending").length,
    held: drafts.filter((draft) => draft.status === "held").length,
  };
}

function trimRuns(
  runs: readonly MonitorRun[],
  drafts: Readonly<Record<string, DraftAction>>,
): { runs: readonly MonitorRun[]; drafts: Readonly<Record<string, DraftAction>> } {
  if (runs.length <= MAX_RUNS) {
    return { runs, drafts };
  }
  const kept = runs.slice(runs.length - MAX_RUNS);
  const keptIds = new Set(kept.map((run) => run.id));
  return {
    runs: kept,
    drafts: Object.fromEntries(
      Object.entries(drafts).filter(([, draft]) => keptIds.has(draft.runId)),
    ),
  };
}

function touchMonitor(monitor: Monitor, now: Date): Monitor {
  const upcoming = nextRunFromText(monitor.schedule, now);
  return {
    ...monitor,
    lastRunAt: now.toISOString(),
    ...(upcoming ? { nextRunAt: upcoming.toISOString() } : {}),
  };
}

/** Append a run, evaluate every draft in order, and return the new workspace. */
export function applyRun(
  ws: Workspace,
  monitor: Monitor,
  findings: readonly string[],
  candidates: readonly DraftCandidate[],
  now: Date,
): AppliedRun {
  const runId = nextRunId(ws);
  const at = now.toISOString();
  const { drafts } = foldDrafts(monitor, candidates, runId, at);
  const run: MonitorRun = {
    id: runId,
    monitorId: monitor.id,
    runner: monitor.runner,
    startedAt: at,
    finishedAt: at,
    findings,
    draftIds: drafts.map((draft) => draft.id),
  };
  const merged = trimRuns(
    [...ws.runs, run],
    {
      ...ws.drafts,
      ...Object.fromEntries(drafts.map((draft) => [draft.id, draft])),
    },
  );

  return {
    next: {
      ...ws,
      monitors: { ...ws.monitors, [monitor.id]: touchMonitor(monitor, now) },
      runs: merged.runs,
      drafts: merged.drafts,
      updatedAt: at,
    },
    run,
    drafts,
    counts: countStatuses(drafts),
  };
}

/** Autos already spent in a run, so approve_draft re-checks against the same cap. */
export function autosInRun(ws: Workspace, runId: string): number {
  return Object.values(ws.drafts).filter(
    (draft) => draft.runId === runId && draft.status === "auto",
  ).length;
}

export function withAudit(ws: Workspace, event: AuditEvent): Workspace {
  const audit = [...ws.audit, event];
  return {
    ...ws,
    audit:
      audit.length > LIMITS.maxAuditEvents
        ? audit.slice(audit.length - LIMITS.maxAuditEvents)
        : audit,
  };
}

/** JSON array replies drop whole trailing items instead of truncating mid-string. */
export function capJsonArray(items: readonly unknown[]): string {
  const kept = [...items];
  let text = JSON.stringify(kept);
  while (text.length > LIMITS.toolOutputChars && kept.length > 0) {
    kept.pop();
    text = JSON.stringify(kept);
  }
  return text;
}

/** Every tool reply stays inside LIMITS.toolOutputChars. */
export function capOutput(text: string): string {
  return text.length > LIMITS.toolOutputChars
    ? `${text.slice(0, LIMITS.toolOutputChars - 1)}…`
    : text;
}
