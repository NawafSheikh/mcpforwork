/**
 * Whole-board messages: what a late joiner is sent, and how it is read back.
 *
 * A snapshot is additive: it carries what the sender holds, so adopting one merges entity
 * by entity and never removes anything the receiver has and the sender does not.
 *
 * A share link deliberately leaves the audit trail behind, because a snapshot goes to a
 * stranger. A room is the opposite situation: the people in it are working the same board
 * together and the point is that callers and humans from every browser land in ONE rail,
 * so the room snapshot carries the tail of the trail as well. It is still capped, still
 * merged by id, and still never overwrites an event another browser already holds.
 */
import { fromSnapshot, toSnapshot, type Snapshot } from "../share/snapshot";
import { asArray } from "../share/coerce";
import type { AuditEvent, Workspace } from "../types";
import { fullPatches } from "./diff";
import { ROOM_LIMITS, type RoomPatch } from "./types";
import { coerceAuditEvent } from "./wire";

export interface RoomSnapshot extends Snapshot {
  /** The newest ROOM_LIMITS.auditPerMessage events, oldest first. */
  readonly audit: readonly AuditEvent[];
}

export function roomSnapshot(ws: Workspace): RoomSnapshot {
  return { ...toSnapshot(ws), audit: ws.audit.slice(-ROOM_LIMITS.auditPerMessage) };
}

function auditPatches(raw: unknown, origin: string, at: string): readonly RoomPatch[] {
  const out: RoomPatch[] = [];
  for (const item of asArray(raw, ROOM_LIMITS.auditPerMessage)) {
    const event = coerceAuditEvent(item, at);
    if (event !== null) out.push({ kind: "audit", key: event.id, value: event, at: event.at, origin });
  }
  return out;
}

/**
 * A peer's whole board as patches, so adoption runs through the same last-writer-wins
 * path as every other change. A late joiner therefore cannot be talked backwards: an
 * entity this browser edited more recently keeps the local value.
 *
 * The patches are stamped with the sender's board updatedAt, never with "now". A snapshot
 * is a picture of a board as it stood, so it must lose to any local edit made after that
 * moment; stamping it with the send time would let an old board overwrite a fresh one.
 */
export function snapshotPatches(raw: unknown, origin: string, at: string): readonly RoomPatch[] {
  const ws = fromSnapshot(raw, new Date(at));
  if (ws === null) return [];
  const audit = typeof raw === "object" && raw !== null ? (raw as { audit?: unknown }).audit : undefined;
  const patches = [...fullPatches(ws, origin, ws.updatedAt), ...auditPatches(audit, origin, at)];
  // A snapshot says what a board has, never what it lacks. Even an empty one is only ever
  // additive, so adopting it can add entities and can never take one away.
  return patches.filter((patch) => patch.value !== null);
}
