/**
 * Live adapter: the console board mirrored onto the clawai.eu /api/coc API.
 *
 * Rules this file obeys:
 * - Best effort. syncWorkspaceToLive and pullFromLive never throw at the caller.
 *   Every failure comes back as a result object and is written to the audit rail
 *   as an event with actor "system", so the board shows what did not happen.
 * - A local board is never touched. A workspace whose mode is "local" is skipped.
 * - Only endpoints that exist are called (see PATHS in ./mapping.ts).
 */
import { LIMITS, type AuditEvent, type Monitor, type MonitorRun, type Workspace, type WorkspaceStore } from "../types";
import { friendlyMessage, apiFetch, LiveError } from "./client";
import {
  PATHS,
  configToPolicy,
  createAgentBody,
  monitorIdOf,
  patchAgentBody,
  unwrapAgent,
  unwrapList,
  type ClawaiAgent,
  type ClawaiAgentRun,
} from "./mapping";

export interface LiveResult {
  readonly ok: boolean;
  readonly message: string;
  readonly changed: number;
  readonly failed: number;
}

/**
 * monitor id -> clawai agent id, held in memory for this tab only.
 * The durable link is `config.monitor_id` on the clawai agent, which pullFromLive
 * and syncWorkspaceToLive both re-read, so losing this map costs one extra GET.
 */
let remoteAgentIds: Readonly<Record<string, string>> = {};

function rememberAgentId(monitorId: string, agentId: string): void {
  remoteAgentIds = { ...remoteAgentIds, [monitorId]: agentId };
}

export function remoteAgentIdFor(monitorId: string): string | undefined {
  return remoteAgentIds[monitorId];
}

function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return "aud_" + c.randomUUID().slice(0, 8);
  return "aud_" + Math.random().toString(36).slice(2, 10);
}

function auditEvent(tool: string, ok: boolean, result: string, preview?: string): AuditEvent {
  return {
    id: newId(),
    at: new Date().toISOString(),
    actor: "system",
    tool,
    ok,
    result: result.slice(0, LIMITS.toolOutputChars),
    ...(preview ? { argsPreview: preview.slice(0, LIMITS.paramDescriptionChars) } : {}),
  };
}

/** Append an audit event. Swallows store failures: audit must never break a sync. */
async function record(store: WorkspaceStore, event: AuditEvent): Promise<void> {
  try {
    await store.update((ws) => ({
      ...ws,
      audit: [...ws.audit, event].slice(-LIMITS.maxAuditEvents),
      updatedAt: event.at,
    }));
  } catch {
    // Nothing else to do: the caller already has the failure in its result object.
  }
}

function skipReason(ws: Workspace): string | null {
  if (ws.mode !== "live") return "This is a local board, so nothing was sent to clawai.";
  return null;
}

/* ---------- push ---------- */

async function fetchAgents(): Promise<readonly ClawaiAgent[]> {
  const payload = await apiFetch<unknown>(PATHS.agents);
  return unwrapList<ClawaiAgent>(payload, "agents");
}

function indexByMonitor(agents: readonly ClawaiAgent[]): Readonly<Record<string, ClawaiAgent>> {
  return agents.reduce<Record<string, ClawaiAgent>>((acc, agent) => {
    const monitorId = monitorIdOf(agent);
    return monitorId ? { ...acc, [monitorId]: agent } : acc;
  }, {});
}

async function pushOne(monitor: Monitor, existing: ClawaiAgent | undefined): Promise<void> {
  if (existing) {
    await apiFetch<unknown>(PATHS.agent(existing.id), {
      method: "PATCH",
      body: patchAgentBody(monitor),
    });
    rememberAgentId(monitor.id, existing.id);
    return;
  }
  const created = unwrapAgent(
    await apiFetch<unknown>(PATHS.agents, { method: "POST", body: createAgentBody(monitor) }),
  );
  if (!created) throw new LiveError("parse", "clawai created the agent but returned no id.");
  rememberAgentId(monitor.id, created.id);
}

/**
 * Push every monitor in the workspace to clawai as an agent: create the ones that
 * are new, PATCH the ones that already carry this monitor id in their config.
 * Dashboards and categories stay on the page; clawai has no store for that shape.
 */
export async function syncWorkspaceToLive(store: WorkspaceStore): Promise<LiveResult> {
  const ws = store.get();
  const skip = skipReason(ws);
  if (skip) return { ok: false, message: skip, changed: 0, failed: 0 };

  let byMonitor: Readonly<Record<string, ClawaiAgent>> = {};
  try {
    byMonitor = indexByMonitor(await fetchAgents());
  } catch (error) {
    const message = friendlyMessage(error);
    await record(store, auditEvent("live.sync", false, "Could not list clawai agents. " + message));
    return { ok: false, message, changed: 0, failed: 0 };
  }

  const monitors = Object.values(ws.monitors);
  const failures: string[] = [];
  let changed = 0;
  for (const monitor of monitors) {
    try {
      await pushOne(monitor, byMonitor[monitor.id]);
      changed += 1;
    } catch (error) {
      failures.push(monitor.name + ": " + friendlyMessage(error));
    }
  }

  const ok = failures.length === 0;
  const message = ok
    ? "Pushed " + changed + " monitor(s) to clawai."
    : "Pushed " + changed + " of " + monitors.length + " monitor(s). " + failures.join(" | ");
  await record(store, auditEvent("live.sync", ok, message));
  return { ok, message, changed, failed: failures.length };
}

/* ---------- pull ---------- */

function mergeMonitor(monitor: Monitor, agent: ClawaiAgent): Monitor {
  const policy = configToPolicy(agent.config);
  return {
    ...monitor,
    status: agent.status === "paused" ? "paused" : "active",
    ...(policy ? { policy } : {}),
    ...(agent.next_run_at ? { nextRunAt: agent.next_run_at } : {}),
    ...(agent.last_run_at ? { lastRunAt: agent.last_run_at } : {}),
  };
}

/**
 * verify against live API: agent runs are mapped onto MonitorRun with the remote
 * summary as a single finding and no drafts, because clawai keeps drafts in
 * /api/coc/suggestions, which the console pulls only when a draft is approved.
 */
function toMonitorRun(run: ClawaiAgentRun, monitorId: string): MonitorRun {
  return {
    id: "live_" + run.id,
    monitorId,
    runner: "cloud",
    startedAt: run.started_at ?? new Date().toISOString(),
    ...(run.finished_at ? { finishedAt: run.finished_at } : {}),
    findings: [run.summary ?? run.error ?? ("Run " + (run.status ?? "finished") + " on the clawai cloud runner.")],
    draftIds: [],
  };
}

function applyPull(
  ws: Workspace,
  agents: readonly ClawaiAgent[],
  runs: readonly ClawaiAgentRun[],
): Workspace {
  const byMonitor = indexByMonitor(agents);
  const monitors = Object.entries(ws.monitors).reduce<Record<string, Monitor>>((acc, [id, monitor]) => {
    const agent = byMonitor[id];
    return { ...acc, [id]: agent ? mergeMonitor(monitor, agent) : monitor };
  }, {});
  const monitorByAgent = agents.reduce<Record<string, string>>((acc, agent) => {
    const monitorId = monitorIdOf(agent);
    return monitorId ? { ...acc, [agent.id]: monitorId } : acc;
  }, {});
  const known = new Set(ws.runs.map((r) => r.id));
  const extra = runs
    .filter((r) => r.agent_id !== undefined && monitorByAgent[r.agent_id] !== undefined)
    .map((r) => toMonitorRun(r, monitorByAgent[r.agent_id as string] as string))
    .filter((r) => !known.has(r.id));
  return {
    ...ws,
    monitors,
    runs: [...ws.runs, ...extra],
    updatedAt: new Date().toISOString(),
  };
}

/** Pull agent status, schedule and recent runs back from clawai into the board. */
export async function pullFromLive(store: WorkspaceStore): Promise<LiveResult> {
  const ws = store.get();
  const skip = skipReason(ws);
  if (skip) return { ok: false, message: skip, changed: 0, failed: 0 };

  try {
    const agents = await fetchAgents();
    const runsPayload = await apiFetch<unknown>(PATHS.agentRuns, { query: { limit: 20 } });
    const runs = unwrapList<ClawaiAgentRun>(runsPayload, "runs");
    agents.forEach((agent) => {
      const monitorId = monitorIdOf(agent);
      if (monitorId) rememberAgentId(monitorId, agent.id);
    });
    const next = await store.update((current) => applyPull(current, agents, runs));
    const message = "Pulled " + agents.length + " agent(s) and " + runs.length + " run(s) from clawai.";
    await record(store, auditEvent("live.pull", true, message));
    return { ok: true, message, changed: Object.keys(next.monitors).length, failed: 0 };
  } catch (error) {
    const message = friendlyMessage(error);
    await record(store, auditEvent("live.pull", false, "Pull from clawai failed. " + message));
    return { ok: false, message, changed: 0, failed: 1 };
  }
}

/* ---------- single actions ---------- */

/** POST /api/coc/agents/{id}/run-now. Best effort, returns a result rather than throwing. */
export async function runMonitorNow(store: WorkspaceStore, monitorId: string): Promise<LiveResult> {
  const ws = store.get();
  const skip = skipReason(ws);
  if (skip) return { ok: false, message: skip, changed: 0, failed: 0 };
  const agentId = remoteAgentIds[monitorId];
  if (!agentId) {
    const message = "That monitor has not been pushed to clawai yet. Sync first.";
    await record(store, auditEvent("live.run_now", false, message, "monitorId=" + monitorId));
    return { ok: false, message, changed: 0, failed: 1 };
  }
  try {
    await apiFetch<unknown>(PATHS.runNow(agentId), { method: "POST" });
    const message = "clawai started a run for " + monitorId + ".";
    await record(store, auditEvent("live.run_now", true, message));
    return { ok: true, message, changed: 1, failed: 0 };
  } catch (error) {
    const message = friendlyMessage(error);
    await record(store, auditEvent("live.run_now", false, "run-now failed. " + message));
    return { ok: false, message, changed: 0, failed: 1 };
  }
}

/**
 * The clawai suggestion id a draft mirrors, if the run that produced it recorded one.
 * verify against live API: report_monitor_run has no clawai counterpart, so a draft
 * only carries a remote id when the local runner staged it through
 * POST /api/coc/draft-action and put the returned id in fields.remote_suggestion_id.
 */
function remoteSuggestionId(ws: Workspace, draftId: string): string | null {
  const value = ws.drafts[draftId]?.fields?.remote_suggestion_id;
  return typeof value === "string" ? value : null;
}

async function decide(
  store: WorkspaceStore,
  draftId: string,
  path: (id: string) => string,
  tool: string,
  body?: unknown,
): Promise<LiveResult> {
  const ws = store.get();
  const skip = skipReason(ws);
  if (skip) return { ok: false, message: skip, changed: 0, failed: 0 };
  const suggestionId = remoteSuggestionId(ws, draftId);
  if (!suggestionId) {
    const message = "Draft " + draftId + " has no clawai suggestion id, so it stays local only.";
    await record(store, auditEvent(tool, false, message, "draftId=" + draftId));
    return { ok: false, message, changed: 0, failed: 1 };
  }
  try {
    await apiFetch<unknown>(path(suggestionId), { method: "POST", ...(body ? { body } : {}) });
    const message = "clawai accepted the decision on " + draftId + ".";
    await record(store, auditEvent(tool, true, message, "draftId=" + draftId));
    return { ok: true, message, changed: 1, failed: 0 };
  } catch (error) {
    const message = friendlyMessage(error);
    await record(store, auditEvent(tool, false, "Decision on " + draftId + " failed. " + message));
    return { ok: false, message, changed: 0, failed: 1 };
  }
}

/** Approve executes immediately on clawai, so the caller must have run the policy check first. */
export function approveDraftLive(store: WorkspaceStore, draftId: string): Promise<LiveResult> {
  return decide(store, draftId, PATHS.approve, "live.approve");
}

export function rejectDraftLive(store: WorkspaceStore, draftId: string, reason?: string): Promise<LiveResult> {
  return decide(store, draftId, PATHS.reject, "live.reject", reason ? { reason } : undefined);
}
