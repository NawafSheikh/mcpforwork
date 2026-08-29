/**
 * The remote change pulse: who last changed the thing you are looking at.
 *
 * It reads the audit rail rather than a separate feed, because the rail is already
 * shared across a room, so a change made in somebody else's browser shows here with
 * their name on it the moment the patch lands.
 */
import type { AuditEvent, Workspace } from "../../types";
import { peerOf } from "./feed";
import { placeForEvent, samePlace, type Place } from "./places";

/** How long a change stays worth pointing at. */
export const PULSE_MS = 120_000;

export interface Pulse {
  readonly eventId: string;
  readonly by: string;
  readonly at: string;
  readonly agent: boolean;
}

function isFresh(event: AuditEvent, now: number): boolean {
  const at = Date.parse(event.at);
  return Number.isFinite(at) && now - at >= 0 && now - at < PULSE_MS;
}

/** The newest change on this place, or null when nothing landed recently. */
export function pulseFor(
  workspace: Workspace,
  place: Place,
  now: number = Date.now(),
): Pulse | null {
  for (let i = workspace.audit.length - 1; i >= 0; i -= 1) {
    const event = workspace.audit[i];
    if (event === undefined || !event.ok || event.actor === "system") continue;
    if (!isFresh(event, now)) return null;
    const target = placeForEvent(event, workspace);
    if (target !== null && samePlace(target, place)) {
      return { eventId: event.id, by: peerOf(event), at: event.at, agent: event.actor === "agent" };
    }
  }
  return null;
}
