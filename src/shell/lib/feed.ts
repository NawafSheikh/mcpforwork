/**
 * The live feed: every call and every human action, newest first, grouped by the peer
 * that made it so a burst from one sub-agent reads as one block instead of ten lines.
 * Pure, so the grouping and the filter are testable without a render.
 */
import type { AuditEvent, Workspace } from "../../types";
import { callerName } from "./format";

export const EVERYONE = "all";

/** The name a run of events is grouped under: a caller, a person, or the system. */
export function peerOf(event: AuditEvent): string {
  if (event.actor === "system") return "System";
  const caller = event.caller?.trim();
  if (caller !== undefined && caller.length > 0) return caller;
  return event.actor === "agent" ? callerName(event) : "A person";
}

export interface FeedGroup {
  readonly id: string;
  readonly peer: string;
  readonly actor: AuditEvent["actor"];
  readonly events: readonly AuditEvent[];
}

/** Every peer that has ever appeared, so the filter can offer them by name. */
export function feedPeers(workspace: Workspace): readonly string[] {
  return [...new Set(workspace.audit.map(peerOf))].sort((a, b) => a.localeCompare(b));
}

/** Newest first, filtered, then collapsed into runs of the same peer. */
export function groupFeed(
  events: readonly AuditEvent[],
  peer: string = EVERYONE,
  limit = 40,
): readonly FeedGroup[] {
  const chosen = [...events]
    .reverse()
    .filter((event) => peer === EVERYONE || peerOf(event) === peer)
    .slice(0, limit);
  const groups: FeedGroup[] = [];
  for (const event of chosen) {
    const name = peerOf(event);
    const last = groups[groups.length - 1];
    if (last !== undefined && last.peer === name && last.actor === event.actor) {
      groups[groups.length - 1] = { ...last, events: [...last.events, event] };
      continue;
    }
    groups.push({ id: event.id, peer: name, actor: event.actor, events: [event] });
  }
  return groups;
}
