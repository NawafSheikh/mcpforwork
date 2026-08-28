/**
 * Shapes and translations between the console model (src/types.ts) and the
 * clawai.eu /api/coc model.
 *
 * The endpoint paths and the writable field names below are taken from the
 * verified API report (competitions/webmcp/candidate_clawai.md). Where the
 * report is silent about a response envelope or a field name, the interface
 * here is deliberately narrow and optional, and is marked "verify against live API".
 */
import type { Monitor, Policy } from "../types";
import { policySchema } from "../webmcp/schemas";

/* ---------- endpoint paths (verified present in coc/routes.py) ---------- */

export const PATHS = {
  agents: "/api/coc/agents",
  agent: (id: string) => "/api/coc/agents/" + encodeURIComponent(id),
  runNow: (id: string) => "/api/coc/agents/" + encodeURIComponent(id) + "/run-now",
  agentRuns: "/api/coc/agent-runs",
  approve: (id: string) => "/api/coc/suggestions/" + encodeURIComponent(id) + "/approve",
  reject: (id: string) => "/api/coc/suggestions/" + encodeURIComponent(id) + "/reject",
} as const;

/** clawai only accepts these three agent types. Monitors are watchers. */
export const AGENT_TYPE = "goal_watcher";

/** Stamped into config so the console can find the agents it owns. */
export const SOURCE_TAG = "mcpforwork";

/* ---------- narrow response shapes ---------- */

/**
 * One agent as clawai returns it.
 * verify against live API: the report confirms the writable keys (name, goal,
 * toolkits, schedule_cron, status, config, next_run_at) but not the exact
 * casing of the read-back timestamps, so every field except id is optional.
 */
export interface ClawaiAgent {
  readonly id: string;
  readonly name?: string;
  readonly agent_type?: string;
  readonly goal?: string;
  readonly schedule_cron?: string;
  readonly status?: string;
  readonly next_run_at?: string | null;
  readonly last_run_at?: string | null;
  readonly config?: Record<string, unknown> | null;
}

/**
 * One agent run as clawai returns it from GET /api/coc/agent-runs.
 * verify against live API: the report confirms the endpoint, the `status` and
 * `limit` query params and the newest-first ordering, not the field names.
 */
export interface ClawaiAgentRun {
  readonly id: string;
  readonly agent_id?: string;
  readonly status?: string;
  readonly started_at?: string;
  readonly finished_at?: string | null;
  readonly summary?: string;
  readonly error?: string | null;
}

/**
 * Lists may come back bare or wrapped. verify against live API: the report does
 * not quote a response envelope, so accept both rather than guessing one.
 */
export function unwrapList<T>(payload: unknown, key: string): readonly T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const wrapped = (payload as Record<string, unknown>)[key];
    if (Array.isArray(wrapped)) return wrapped as T[];
    const items = (payload as Record<string, unknown>).items;
    if (Array.isArray(items)) return items as T[];
  }
  return [];
}

/** POST /api/coc/agents returns the created agent, possibly wrapped in {agent}. */
export function unwrapAgent(payload: unknown): ClawaiAgent | null {
  if (!payload || typeof payload !== "object") return null;
  const direct = payload as Record<string, unknown>;
  if (typeof direct.id === "string") return payload as ClawaiAgent;
  const nested = direct.agent;
  if (nested && typeof nested === "object" && typeof (nested as ClawaiAgent).id === "string") {
    return nested as ClawaiAgent;
  }
  return null;
}

/* ---------- schedule translation ---------- */

const DEFAULT_CRON = "0 9 * * *";
const CRON_FIELDS = 5;

function pad(value: number): string {
  return String(value);
}

/**
 * Turn the console schedule (cron, or plain English as the register_monitor tool
 * accepts it) into the 5-field cron string clawai stores in schedule_cron.
 * clawai only validates that there are 5 whitespace-separated fields.
 */
export function toCron(schedule: string): string {
  const text = schedule.trim().toLowerCase();
  if (text.split(/\s+/).length === CRON_FIELDS && /[*\d]/.test(text)) {
    return schedule.trim();
  }
  if (/every\s+hour|hourly/.test(text)) return "0 * * * *";
  if (/every\s+(15|quarter)/.test(text)) return "*/15 * * * *";
  const clock = /(\d{1,2}):(\d{2})/.exec(text);
  if (clock && clock[1] && clock[2]) {
    const hour = Number(clock[1]) % 24;
    const minute = Number(clock[2]) % 60;
    if (/monday|weekly/.test(text)) return pad(minute) + " " + pad(hour) + " * * 1";
    return pad(minute) + " " + pad(hour) + " * * *";
  }
  if (/morning/.test(text)) return "0 8 * * *";
  if (/evening/.test(text)) return "0 18 * * *";
  return DEFAULT_CRON;
}

/* ---------- policy translation ---------- */

/**
 * clawai has no policy endpoint. The report confirms the autonomy keys it already
 * reads out of an agent's `config`: max_auto_actions_per_run and auto_allow.
 * The full console policy rides along under `policy` so it round-trips intact.
 */
export function policyToConfig(monitor: Monitor): Record<string, unknown> {
  return {
    source: SOURCE_TAG,
    monitor_id: monitor.id,
    category: monitor.category,
    runner: monitor.runner,
    schedule_text: monitor.schedule,
    max_auto_actions_per_run: monitor.policy.maxAutoActionsPerRun,
    auto_allow: monitor.policy.allowlist ?? [],
    policy: monitor.policy,
  };
}

/** Read the console policy back out of an agent config, when this console wrote it. */
export function configToPolicy(config: Record<string, unknown> | null | undefined): Policy | null {
  if (!config) return null;
  const stored = config.policy;
  if (stored && typeof stored === "object" && "maxAutoActionsPerRun" in stored) {
    // The only policy input that arrives from outside the page: validate like every tool input.
    const parsed = policySchema.safeParse(stored);
    return parsed.success ? (parsed.data as Policy) : null;
  }
  const cap = config.max_auto_actions_per_run;
  if (typeof cap === "number") {
    const allow = config.auto_allow;
    return {
      maxAutoActionsPerRun: cap,
      ...(Array.isArray(allow) ? { allowlist: allow.filter((x): x is string => typeof x === "string") } : {}),
    };
  }
  return null;
}

/** The console monitor id this agent was created from, when there is one. */
export function monitorIdOf(agent: ClawaiAgent): string | null {
  const value = agent.config?.monitor_id;
  return typeof value === "string" ? value : null;
}

/** Body for POST /api/coc/agents. */
export function createAgentBody(monitor: Monitor): Record<string, unknown> {
  return {
    name: monitor.name,
    agent_type: AGENT_TYPE,
    goal:
      "Watch the " +
      monitor.category +
      " category and report findings and drafts back to the MCP for Work board. " +
      "Hold anything the policy does not allow.",
    toolkits: [],
    schedule_cron: toCron(monitor.schedule),
    config: policyToConfig(monitor),
    source: SOURCE_TAG,
  };
}

/** Body for PATCH /api/coc/agents/{id}. Only keys clawai allows are sent. */
export function patchAgentBody(monitor: Monitor): Record<string, unknown> {
  return {
    name: monitor.name,
    schedule_cron: toCron(monitor.schedule),
    status: monitor.status === "paused" ? "paused" : "active",
    config: policyToConfig(monitor),
  };
}
