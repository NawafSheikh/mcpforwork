/**
 * Audit helpers for the workspace store.
 * Every tool call leaves one AuditEvent: who, which tool, a deterministic hash of the
 * arguments and a short preview. Hashing keeps the rail readable without storing payloads.
 * The optional caller is the sub-agent's own label, so parallel workers stay apart in the rail.
 */

import { LIMITS, type Actor, type AuditEvent, type Workspace } from "../types";

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const PREVIEW_CHARS = 120;
const RESULT_CHARS = 160;
const MAX_DEPTH = 6;

/** Cut text to max chars, marking the cut so nobody mistakes it for the whole value. */
export function truncate(text: string, max: number): string {
  if (max <= 0) return "";
  if (text.length <= max) return text;
  if (max <= 3) return text.slice(0, max);
  return `${text.slice(0, max - 3)}...`;
}

/** FNV-1a, 32 bit, hex. Deterministic and dependency free. */
export function fnv1aHex(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** JSON with sorted keys so the same arguments always hash to the same value. */
export function stableStringify(value: unknown, depth = 0): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value) ?? "null";
  }
  if (typeof value !== "object") return "null";
  if (depth >= MAX_DEPTH) return '"[deep]"';
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item, depth + 1)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const body = entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item, depth + 1)}`)
    .join(",");
  return `{${body}}`;
}

export interface AuditInput {
  readonly actor: Actor;
  /** Self-reported name of the agent or sub-agent behind the call. Display only. */
  readonly caller?: string;
  readonly tool?: string;
  readonly args?: unknown;
  readonly result?: string;
  readonly ok: boolean;
}

/** The caller is agent supplied, so it is trimmed and capped before it is stored. */
function cleanCaller(caller: string | undefined): string | undefined {
  if (typeof caller !== "string") return undefined;
  const text = caller.trim();
  return text.length > 0 ? truncate(text, LIMITS.maxCallerChars) : undefined;
}

let sequence = 0;

/** Build an AuditEvent with a short deterministic argsHash and a 120 char preview. */
export function makeAuditEvent(input: AuditInput): AuditEvent {
  const at = new Date().toISOString();
  sequence += 1;
  const serialized = input.args === undefined ? "" : stableStringify(input.args);
  const hash = serialized === "" ? undefined : fnv1aHex(serialized);
  return {
    id: `ev_${sequence.toString(36)}_${fnv1aHex(`${at}:${input.tool ?? ""}:${serialized}`)}`,
    at,
    actor: input.actor,
    caller: cleanCaller(input.caller),
    tool: input.tool,
    argsHash: hash,
    argsPreview: serialized === "" ? undefined : truncate(serialized, PREVIEW_CHARS),
    result: input.result === undefined ? undefined : truncate(input.result, RESULT_CHARS),
    ok: input.ok,
  };
}

/** Keep the newest LIMITS.maxAuditEvents entries, oldest first in the array. */
export function capAudit(events: readonly AuditEvent[]): readonly AuditEvent[] {
  if (events.length <= LIMITS.maxAuditEvents) return events;
  return events.slice(events.length - LIMITS.maxAuditEvents);
}

/** Immutably append one event to a workspace, respecting the cap. */
export function appendAudit(ws: Workspace, event: AuditEvent): Workspace {
  return { ...ws, audit: capAudit([...ws.audit, event]) };
}
