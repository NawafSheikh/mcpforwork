/**
 * Pure read helpers over a Workspace. No state, no side effects, safe in render.
 */

import type {
  Category,
  DraftAction,
  Monitor,
  MonitorRun,
  Workspace,
  WorkspaceMode,
} from "../types";

export interface CategoryDigest {
  readonly name: string;
  readonly description?: string;
  readonly hasSummary: boolean;
  readonly hasDashboard: boolean;
}

export interface MonitorDigest {
  readonly id: string;
  readonly name: string;
  readonly schedule: string;
  readonly status: Monitor["status"];
  readonly nextRunAt?: string;
}

/** Exactly the JSON shape get_workspace returns (docs/TOOLS.md). */
export interface WorkspaceSummary {
  readonly mode: WorkspaceMode;
  readonly categories: readonly CategoryDigest[];
  readonly hasOverview: boolean;
  readonly monitors: readonly MonitorDigest[];
  readonly pendingDrafts: number;
  readonly heldDrafts: number;
}

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);

export function listCategories(ws: Workspace): readonly Category[] {
  return Object.values(ws.categories).sort(byName);
}

export function listMonitors(ws: Workspace): readonly Monitor[] {
  return Object.values(ws.monitors).sort(byName);
}

export function listDrafts(ws: Workspace): readonly DraftAction[] {
  return Object.values(ws.drafts);
}

export function pendingDrafts(ws: Workspace): readonly DraftAction[] {
  return listDrafts(ws).filter((draft) => draft.status === "pending");
}

export function heldDrafts(ws: Workspace): readonly DraftAction[] {
  return listDrafts(ws).filter((draft) => draft.status === "held");
}

/** Runs for one monitor, newest first, optionally capped. */
export function runsForMonitor(
  ws: Workspace,
  monitorId?: string,
  limit?: number,
): readonly MonitorRun[] {
  const matched = monitorId ? ws.runs.filter((run) => run.monitorId === monitorId) : [...ws.runs];
  const newestFirst = [...matched].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return typeof limit === "number" && limit > 0 ? newestFirst.slice(0, limit) : newestFirst;
}

function categoryDigest(category: Category): CategoryDigest {
  return {
    name: category.name,
    description: category.description,
    hasSummary: category.summary !== undefined,
    hasDashboard: category.dashboard !== undefined,
  };
}

function monitorDigest(monitor: Monitor): MonitorDigest {
  return {
    id: monitor.id,
    name: monitor.name,
    schedule: monitor.schedule,
    status: monitor.status,
    nextRunAt: monitor.nextRunAt,
  };
}

export function workspaceSummary(ws: Workspace): WorkspaceSummary {
  return {
    mode: ws.mode,
    categories: listCategories(ws).map(categoryDigest),
    hasOverview: ws.overview !== undefined,
    monitors: listMonitors(ws).map(monitorDigest),
    pendingDrafts: pendingDrafts(ws).length,
    heldDrafts: heldDrafts(ws).length,
  };
}
