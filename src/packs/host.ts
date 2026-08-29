/**
 * Who may move the switches.
 *
 * On a board that is not in a room, the person looking at it decides: it is their page.
 * Inside a room the host decides, and everybody else sees the switches with the reason
 * why they are disabled (docs/PACKS.md).
 *
 * Rooms has no host of its own yet, so this reads one if it ever exposes one (`hostId`
 * on the runtime) and otherwise falls back to the first peer, defined as the lowest
 * client id in presence. That is not "whoever created the room", but it is the only
 * rule every browser in the room computes the same answer for without asking anybody,
 * which is the property that matters: two peers must never both think they are host.
 */

import { getRoomRuntime, subscribeRoomRuntime } from "../rooms/runtime";
import type { RoomRuntime } from "../rooms/sync";

export const NOT_HOST_REASON = "Only the host can change tools in this room.";

interface MaybeHosted {
  readonly hostId?: unknown;
}

function exposedHost(runtime: RoomRuntime): string | null {
  const raw = (runtime as unknown as MaybeHosted).hostId;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/** The lowest client id in the room, which every peer computes identically. */
export function firstPeerId(peers: readonly { readonly clientId: string }[]): string | null {
  let best: string | null = null;
  for (const peer of peers) {
    if (best === null || peer.clientId < best) best = peer.clientId;
  }
  return best;
}

export function inRoom(): boolean {
  return getRoomRuntime() !== null;
}

/** The client id of the host, or null on a local board and before the first hello. */
export function roomHostId(): string | null {
  const runtime = getRoomRuntime();
  if (runtime === null) return null;
  return exposedHost(runtime) ?? firstPeerId(runtime.peers().peers);
}

/**
 * True when this browser may flip a switch: always on a local board, and in a room only
 * for the host. An empty presence list means the room has said nothing yet, and the one
 * browser in it is the host by default.
 */
export function maySwitchPacks(): boolean {
  const runtime = getRoomRuntime();
  if (runtime === null) return true;
  const host = roomHostId();
  return host === null || host === runtime.clientId;
}

/** The label of the host, for the disabled-switch line. "the host" when unknown. */
export function hostLabel(): string {
  const runtime = getRoomRuntime();
  const host = roomHostId();
  if (runtime === null || host === null) return "the host";
  const peer = runtime.peers().peers.find((item) => item.clientId === host);
  return peer === undefined || peer.label.length === 0 ? "the host" : peer.label;
}

/** "" when you may switch, otherwise the sentence to show under the disabled switches. */
export function switchBlockedReason(): string {
  return maySwitchPacks() ? "" : `${NOT_HOST_REASON} Ask ${hostLabel()}.`;
}

/** Fires when the room opens, closes, or its peer list changes. */
export function subscribeHost(listener: () => void): () => void {
  let stopPresence = getRoomRuntime()?.presence.subscribe(listener) ?? ((): void => undefined);
  const stopRuntime = subscribeRoomRuntime(() => {
    stopPresence();
    stopPresence = getRoomRuntime()?.presence.subscribe(listener) ?? ((): void => undefined);
    listener();
  });
  return () => {
    stopRuntime();
    stopPresence();
  };
}
