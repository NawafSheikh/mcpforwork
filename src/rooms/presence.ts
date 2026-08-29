/**
 * Who else is on this board right now.
 *
 * Presence is deliberately built on the same broadcast messages as everything else rather
 * than on the relay's own presence feature: it has to behave identically when the relay is
 * a Supabase channel, a BroadcastChannel between two tabs, or a Durable Object later.
 *
 * A peer is a browser, not a person, and the label is self-reported. Nothing here is an
 * identity claim: it is a courtesy so a demo can say who is looking at the same board.
 */
import { ROOM_LIMITS, type PeerInfo, type RoomStatus, type RoomTransportKind } from "./types";

export interface RoomPeer extends PeerInfo {
  /** Epoch milliseconds of the last hello from this peer. */
  readonly lastSeenAt: number;
  readonly self: boolean;
}

export interface PresenceState {
  readonly slug: string | null;
  readonly status: RoomStatus;
  readonly transport: RoomTransportKind;
  /** This browser first, then everybody else by label. */
  readonly peers: readonly RoomPeer[];
  /** One per browser in the room, including this one. */
  readonly people: number;
  /** Peers whose browser has site tools registered, so an agent can act there. */
  readonly agents: number;
}

export interface PresenceStore {
  get(): PresenceState;
  subscribe(listener: () => void): () => void;
}

export const IDLE_PRESENCE: PresenceState = {
  slug: null,
  status: "idle",
  transport: "none",
  peers: [],
  people: 0,
  agents: 0,
};

/** "2 people, 2 agents here", the line the header chip shows. */
export function presenceLabel(state: PresenceState): string {
  if (state.slug === null) return "Not in a room";
  const people = `${state.people} ${state.people === 1 ? "person" : "people"}`;
  const agents = `${state.agents} ${state.agents === 1 ? "agent" : "agents"}`;
  return `${people}, ${agents} here`;
}

/** Most recent board first, then the richer board, then the lower client id. */
function beats(peer: RoomPeer, best: RoomPeer): boolean {
  const newer = peer.updatedAt.localeCompare(best.updatedAt);
  if (newer !== 0) return newer > 0;
  if (peer.entities !== best.entities) return peer.entities > best.entities;
  return peer.clientId < best.clientId;
}

function order(a: RoomPeer, b: RoomPeer): number {
  if (a.self !== b.self) return a.self ? -1 : 1;
  const byLabel = a.label.localeCompare(b.label);
  return byLabel !== 0 ? byLabel : a.clientId.localeCompare(b.clientId);
}

function build(
  slug: string,
  status: RoomStatus,
  transport: RoomTransportKind,
  peers: ReadonlyMap<string, RoomPeer>,
): PresenceState {
  const list = [...peers.values()].sort(order).slice(0, ROOM_LIMITS.maxPeers);
  return {
    slug,
    status,
    transport,
    peers: list,
    people: list.length,
    agents: list.filter((peer) => peer.agent).length,
  };
}

export interface PresenceController extends PresenceStore {
  /** Record a hello. Own clientId marks the entry as self. */
  seen(peer: PeerInfo, atMs: number, self: boolean): void;
  forget(clientId: string): void;
  /** Drop peers unseen for ROOM_LIMITS.peerTtlMs. */
  prune(atMs: number): void;
  setStatus(status: RoomStatus): void;
  /**
   * Who should answer a snapshot request: the peer with the most recent board, ties
   * broken on the richer board and then on client id. A peer holding nothing is never
   * the answer, because a joiner's empty board is not the room's state.
   */
  freshest(exclude: string): RoomPeer | null;
  peer(clientId: string): RoomPeer | null;
}

export function createPresenceController(
  slug: string,
  transport: RoomTransportKind,
): PresenceController {
  const peers = new Map<string, RoomPeer>();
  const listeners = new Set<() => void>();
  let status: RoomStatus = "idle";
  let state = build(slug, status, transport, peers);

  const publish = (): void => {
    state = build(slug, status, transport, peers);
    for (const listener of [...listeners]) listener();
  };

  return {
    get: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    seen(peer: PeerInfo, atMs: number, self: boolean): void {
      if (peers.size >= ROOM_LIMITS.maxPeers && !peers.has(peer.clientId)) return;
      peers.set(peer.clientId, { ...peer, lastSeenAt: atMs, self });
      publish();
    },
    forget(clientId: string): void {
      if (peers.delete(clientId)) publish();
    },
    prune(atMs: number): void {
      let changed = false;
      for (const [id, peer] of [...peers.entries()]) {
        if (!peer.self && atMs - peer.lastSeenAt > ROOM_LIMITS.peerTtlMs) {
          peers.delete(id);
          changed = true;
        }
      }
      if (changed) publish();
    },
    setStatus(next: RoomStatus): void {
      if (next === status) return;
      status = next;
      publish();
    },
    freshest(exclude: string): RoomPeer | null {
      let best: RoomPeer | null = null;
      for (const peer of peers.values()) {
        if (peer.clientId === exclude || peer.entities <= 0) continue;
        if (best === null || beats(peer, best)) best = peer;
      }
      return best;
    },
    peer: (clientId: string) => peers.get(clientId) ?? null,
  };
}
