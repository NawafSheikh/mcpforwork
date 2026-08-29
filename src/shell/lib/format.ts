/** Display formatting helpers. Owner A4. */
import type { AuditEvent } from "../../types";

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}...`;
}

export function formatClock(iso: string | undefined): string {
  if (!iso) return "not scheduled";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string, from: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.round((from - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Pull a named value out of an args preview without trusting its shape. */
export function argValue(preview: string | undefined, key: string): string | undefined {
  if (!preview) return undefined;
  const quoted = new RegExp(`"${key}"\s*:\s*"([^"]{1,60})"`).exec(preview);
  if (quoted?.[1]) return quoted[1];
  const bare = new RegExp(`${key}\s*[=:]\s*([^,}\s]{1,60})`).exec(preview);
  return bare?.[1];
}

const TOOL_PHRASES: Readonly<Record<string, string>> = {
  create_category: "ChatGPT created category",
  upsert_dataset_summary: "ChatGPT stored aggregates for",
  upsert_dashboard: "ChatGPT built dashboard:",
  compose_overview: "ChatGPT composed the overview",
  register_monitor: "ChatGPT registered monitor",
  report_monitor_run: "A monitor reported back",
  approve_draft: "ChatGPT approved a draft",
  decline_draft: "ChatGPT declined a draft",
  set_policy: "Policy updated",
  seed_demo_workspace: "Sample workspace loaded",
  clear_workspace: "Workspace cleared",
};

/** Refusals are quoted, never summarised: the sentence is the whole point of them. */
const REFUSAL_CHARS = 120;

/**
 * One short line describing a tool call, safe for a toast.
 *
 * A call that did not go through says why, in the words the agent was given: "Ana changed
 * chart "By supplier" 20 s ago and this would delete it." A toast that said "ChatGPT built
 * dashboard: Invoices | failed" would tell the person nothing they can act on, and the
 * rail and the toast would disagree about what happened.
 */
export function describeToolEvent(event: AuditEvent): string {
  if (!event.ok && event.result) return truncate(event.result, REFUSAL_CHARS);
  const phrase = event.tool ? TOOL_PHRASES[event.tool] : undefined;
  const subject =
    argValue(event.argsPreview, "category") ??
    argValue(event.argsPreview, "name") ??
    argValue(event.argsPreview, "title");
  if (!phrase) {
    const fallback = event.tool ?? "Tool call";
    return subject ? `${fallback}: ${truncate(subject, 40)}` : fallback;
  }
  return subject ? `${phrase} ${truncate(subject, 40)}` : phrase;
}

export function actorIcon(actor: AuditEvent["actor"]): string {
  if (actor === "agent") return "AI";
  if (actor === "human") return "You";
  return "Sys";
}

/** Sub-agents name themselves; anything that did not is plain ChatGPT. */
export function callerName(event: AuditEvent): string {
  const caller = event.caller?.trim();
  return caller !== undefined && caller.length > 0 ? caller : "ChatGPT";
}
