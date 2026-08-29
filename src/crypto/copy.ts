/**
 * The only sentences the UI is allowed to say about encryption.
 *
 * They live here so the badge, the locked screen and the docs cannot drift apart, and so
 * nobody has to invent wording under deadline. There is no jargon past "encrypted": a
 * person clicks Invite, sends the link, and it works. No setting, no passphrase, no key
 * exchange, and no vocabulary the sender has to explain to the receiver.
 */
import type { RoomRole } from "./roomInvite";

/** Sits under the lock badge, next to presence. */
export const ENCRYPTED_BADGE = "Encrypted. Only people with this link can read this room.";

/** The whole locked state: one sentence, one action, no troubleshooting. */
export const LOCKED_ROOM_MESSAGE = "This room is encrypted. Ask the person who invited you for the full link.";
export const LOCKED_ROOM_ACTION = "Open my own board instead";

/** The badge's short label. Two people compare it out loud to confirm one room. */
export function lockBadgeLabel(fp: string): string {
  return `#${fp}`;
}

/** What the Invite button copies into the toast, per role. */
export function inviteToast(role: RoomRole): string {
  return role === "read"
    ? "Read-only link copied. It opens the room and this app will not let it write."
    : "Room link copied. Anyone with it can read and edit this board.";
}
