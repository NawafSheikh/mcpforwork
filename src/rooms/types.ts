/**
 * Room wire types: what multiplayer boards say to each other.
 *
 * A room is a slug in the URL query. Every browser holding that slug keeps its own
 * Workspace and gossips entity-level patches; nothing about the board is stored by the
 * relay. Transport is an interface on purpose, so the Supabase Realtime channel can be
 * swapped for a Cloudflare Durable Object without touching the sync engine.
 *
 * Honest limits of v1, repeated in INTEGRATION.md and in the UI copy:
 * - a room is unlisted, not private: anyone with the link joins and can write;
 * - there is no auth, no per-peer identity beyond a self-reported label;
 * - the relay forwards and forgets, so a room with nobody in it holds nothing.
 */

export type PatchKind =
  | "category"
  | "overview"
  | "monitor"
  | "run"
  | "draft"
  | "feedback"
  | "claim"
  | "write"
  | "audit";

export const PATCH_KINDS: readonly PatchKind[] = [
  "category",
  "overview",
  "monitor",
  "run",
  "draft",
  "feedback",
  "claim",
  "write",
  "audit",
];

/** One entity changed. `value` null means the entity is gone. */
export interface RoomPatch {
  readonly kind: PatchKind;
  /**
   * Category name, monitor id, draft id, run id, feedback id, audit id, "overview", or
   * the "<kind>:<id>" key a claim and a write mark share (docs/TURNS.md).
   */
  readonly key: string;
  readonly value: unknown;
  /** ISO stamp used for last-writer-wins per (kind, key). */
  readonly at: string;
  /** Client id of the browser that made the change. Loop prevention lives on this. */
  readonly origin: string;
}

/** What a peer says about itself on join and on every heartbeat. */
export interface PeerInfo {
  readonly clientId: string;
  readonly label: string;
  /** True when that browser has site tools registered, so an agent can act there. */
  readonly agent: boolean;
  /** The peer's workspace updatedAt, so the freshest board answers a snapshot request. */
  readonly updatedAt: string;
  /**
   * How many entities that peer is holding. A board with none is a joiner, and a joiner
   * never answers a snapshot request: it has nothing to say and saying it empties the
   * room. Ties on updatedAt break on this, so the richer board is the source.
   */
  readonly entities: number;
}

export type RoomMessage =
  | { readonly t: "hello"; readonly from: string; readonly at: string; readonly peer: PeerInfo }
  | { readonly t: "bye"; readonly from: string; readonly at: string }
  | {
      readonly t: "patch";
      readonly from: string;
      readonly at: string;
      readonly patches: readonly RoomPatch[];
    }
  | { readonly t: "need"; readonly from: string; readonly at: string }
  | {
      readonly t: "state";
      readonly from: string;
      readonly at: string;
      readonly to: string;
      readonly snapshot: unknown;
    };

export type RoomStatus = "idle" | "connecting" | "open" | "closed" | "error";

export type RoomTransportKind = "supabase" | "broadcast" | "none";

/**
 * The seam a Durable Object would slot into. Implementations must be fire and forget:
 * send never throws, a dead socket reconnects on its own, and messages may be lost.
 * The sync engine is built to survive loss (heartbeats re-announce, snapshots re-request).
 *
 * What crosses it is `unknown`, not RoomMessage: an encrypted room puts a sealed envelope
 * on the wire instead, and a transport must carry it without understanding it. Coercion
 * into a RoomMessage happens once, in the sync engine, on whatever comes back out.
 */
export interface RoomTransport {
  readonly kind: RoomTransportKind;
  /** The room this transport is bound to. */
  readonly slug: string;
  connect(): void;
  send(message: unknown): void;
  close(): void;
  status(): RoomStatus;
  onMessage(listener: (message: unknown) => void): () => void;
  onStatus(listener: (status: RoomStatus) => void): () => void;
  /** Envelopes this browser could not open. Only an encrypted transport reports any. */
  unreadable?(): number;
}

/**
 * Caps for anything that crosses the wire. Free-tier Supabase Realtime allows a 256 KB
 * broadcast payload, 100 messages per second and 200 concurrent clients, so the message
 * budget below sits well under the payload ceiling and the send path coalesces bursts.
 */
export const ROOM_LIMITS = {
  /** More changes than this in one commit and the peer ships a whole snapshot instead. */
  patchesPerMessage: 80,
  /** Audit is capped hard: a room is not a way to flood somebody else's rail. */
  auditPerMessage: 24,
  /** Bytes. Anything larger is dropped locally and audited rather than sent. */
  maxMessageBytes: 200_000,
  /** Announce presence this often; peers unseen for peerTtlMs drop off the list. */
  heartbeatMs: 5_000,
  peerTtlMs: 20_000,
  /** Coalesce a burst of store commits into one patch message. */
  sendDebounceMs: 50,
  /** A late joiner waits this long for the first snapshot before asking again. */
  snapshotRetryMs: 3_000,
  /** A peer that is not the freshest waits this long before answering a snapshot request. */
  snapshotBackupMs: 700,
  maxPeers: 24,
  labelChars: 40,
} as const;
