/**
 * The sync engine: one store, one transport, one shared board.
 *
 * Outbound, every commit is diffed against the baseline the peers are known to hold and
 * the difference goes out as entity patches. Inbound, patches are coerced and folded in
 * last-writer-wins. Loop prevention is a single rule applied twice: a message stamped with
 * this browser's own client id is ignored, and applying a remote patch also advances the
 * baseline, so re-broadcasting what we just received is arithmetically impossible.
 *
 * Everything is best effort. Messages can be lost, peers can vanish mid-sentence and the
 * socket can die: heartbeats re-announce, snapshots can be re-requested, and last-writer
 * wins converges whatever order things arrive in.
 */
import { appendAudit, makeAuditEvent } from "../store/audit";
import type { Workspace, WorkspaceStore } from "../types";
import { applyNormalized, normalizePatches, noteLocal, type LwwClock } from "./apply";
import { boardSize, capAuditPatches, derivePatches, emptyLike, tooManyPatches } from "./diff";
import { createPresenceController, type PresenceState, type PresenceStore } from "./presence";
import { roomJoinUrl, mintRoomSlug } from "./slug";
import { roomSnapshot, snapshotPatches } from "./snapshot";
import { createRoomTransport } from "./transport";
import {
  ROOM_LIMITS,
  type PeerInfo,
  type RoomMessage,
  type RoomPatch,
  type RoomStatus,
  type RoomTransport,
  type RoomTransportKind,
} from "./types";
import { coerceMessage, encodeMessage } from "./wire";

const EMPTY_CLOCK: LwwClock = {};
const SNAPSHOT_ATTEMPTS = 3;
const BROADCAST_TO_ALL = "*";
export const ROOM_AUDIT_TOOL = "room_sync";

export interface RoomSyncOptions {
  readonly store: WorkspaceStore;
  readonly slug: string;
  /** Self-reported, display only. Defaults to "Guest <id>". */
  readonly label?: string;
  readonly clientId?: string;
  /** Injected by tests and by any future relay. Defaults to the configured transport. */
  readonly transport?: RoomTransport;
  /** True when this browser has site tools registered. Drives the "N agents" chip. */
  readonly agent?: boolean;
}

export interface RoomRuntime {
  readonly slug: string;
  readonly clientId: string;
  readonly kind: RoomTransportKind;
  readonly presence: PresenceStore;
  joinUrl(): string;
  status(): RoomStatus;
  /** Messages this browser could not decrypt: a wrong key, or a peer on another room. */
  unreadable(): number;
  peers(): PresenceState;
  setAgent(present: boolean): void;
  setLabel(label: string): void;
  /** Send any coalesced patch now instead of on the debounce. */
  flush(): void;
  stop(): void;
}

export function mintClientId(): string {
  return `c${mintRoomSlug(12)}`;
}

function systemEvent(text: string, args: unknown) {
  return makeAuditEvent({ actor: "system", tool: ROOM_AUDIT_TOOL, args, result: text, ok: false });
}

/** Everything the engine needs to keep, in one place so the closures stay readable. */
interface SyncState {
  baseline: Workspace;
  clock: LwwClock;
  label: string;
  agent: boolean;
  adopted: boolean;
  asks: number;
  /**
   * True once this browser knows what the room holds: it adopted a snapshot, or it asked
   * the agreed number of times and nobody answered, so its own board is the room's board.
   * Until then it never sends a delete, because it cannot yet tell "this was removed"
   * from "I have not been told about it".
   */
  settled: boolean;
}

export function startRoomSync(options: RoomSyncOptions): RoomRuntime {
  const { store, slug } = options;
  const clientId = options.clientId ?? mintClientId();
  const transport = options.transport ?? createRoomTransport(slug);
  const presence = createPresenceController(slug, transport.kind);
  const backups = new Map<string, ReturnType<typeof setTimeout>>();
  const state: SyncState = {
    // What the peers have been told, which on arrival is nothing: the first flush
    // therefore offers this browser's whole board to the room instead of keeping it.
    baseline: emptyLike(store.get()),
    clock: EMPTY_CLOCK,
    label: options.label ?? `Guest ${clientId.slice(1, 5)}`,
    agent: options.agent === true,
    adopted: false,
    asks: 0,
    settled: false,
  };
  let sendTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let askTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let joined = false;

  const nowIso = (): string => new Date().toISOString();

  /** A local event, so it is broadcast on the next flush and every rail shows the drop. */
  const audit = (text: string, args: unknown): void => {
    void store.update((ws) => appendAudit(ws, systemEvent(text, args)));
  };

  /** One door out: oversized messages are dropped here and said out loud in the rail. */
  const post = (message: RoomMessage): void => {
    if (encodeMessage(message) === null) {
      audit(`A ${message.t} message was too large for the room relay and was not sent.`, { room: slug, t: message.t });
      return;
    }
    transport.send(message);
  };

  const selfInfo = (): PeerInfo => ({
    clientId,
    label: state.label,
    agent: state.agent,
    updatedAt: store.get().updatedAt,
    entities: boardSize(store.get()),
  });

  const touchSelf = (): void => presence.seen(selfInfo(), Date.now(), true);

  const announce = (): void => {
    touchSelf();
    post({ t: "hello", from: clientId, at: nowIso(), peer: selfInfo() });
  };

  /* ---------- outbound ---------- */

  const sendState = (to: string): void => {
    post({ t: "state", from: clientId, at: nowIso(), to, snapshot: roomSnapshot(store.get()) });
  };

  /**
   * Halve an over-budget batch rather than dropping it. Only a single entity too large for
   * the relay on its own is unsendable, and that one is named in the rail.
   */
  const postPatches = (patches: readonly RoomPatch[]): void => {
    if (patches.length === 0) return;
    const message: RoomMessage = { t: "patch", from: clientId, at: nowIso(), patches };
    if (encodeMessage(message) !== null) {
      transport.send(message);
      return;
    }
    const only = patches[0];
    if (patches.length === 1 && only !== undefined) {
      audit(`One change was too large for the room relay: ${only.kind}:${only.key}.`, { room: slug, kind: only.kind });
      return;
    }
    const half = Math.ceil(patches.length / 2);
    postPatches(patches.slice(0, half));
    postPatches(patches.slice(half));
  };

  const sendChanges = (): void => {
    if (stopped) return;
    const current = store.get();
    const patches = derivePatches(state.baseline, current, clientId, nowIso());
    if (patches.length === 0) return;
    // Our own edits stamp the clock whether or not the socket is up, so a peer snapshot
    // arriving after a reconnect cannot talk this browser out of what it changed offline.
    state.clock = noteLocal(state.clock, patches);
    if (transport.status() !== "open") return;
    // A browser still waiting to hear what the room holds sends what it has and nothing
    // else. Deletes wait for the snapshot: a joiner that has never seen an entity must
    // never be the reason it disappears from somebody else's board.
    const sendable = state.settled ? patches : patches.filter((patch) => patch.value !== null);
    // The baseline only advances over what actually went out, so a held-back delete is
    // still in the next diff once this browser knows the room.
    if (sendable.length === patches.length) state.baseline = current;
    if (sendable.length === 0) return;
    if (tooManyPatches(sendable)) {
      sendState(BROADCAST_TO_ALL);
      return;
    }
    postPatches(capAuditPatches(sendable));
  };

  const flush = (): void => {
    if (sendTimer !== null) clearTimeout(sendTimer);
    sendTimer = null;
    sendChanges();
  };

  const scheduleSend = (): void => {
    if (stopped || sendTimer !== null) return;
    sendTimer = setTimeout(flush, ROOM_LIMITS.sendDebounceMs);
  };

  /* ---------- inbound ---------- */

  /**
   * Apply, then advance the baseline by the same patches. The baseline is "what the peers
   * already know", so a local edit still waiting on the debounce survives, and the change
   * that just arrived is never sent back to the peer that sent it.
   */
  const applyRemote = (patches: readonly RoomPatch[], from: string): void => {
    if (patches.length === 0) return;
    const normal = normalizePatches(patches, nowIso());
    void store.update((ws) => {
      const outcome = applyNormalized(ws, normal.patches, state.clock);
      state.clock = outcome.clock;
      return outcome.ws;
    });
    state.baseline = applyNormalized(state.baseline, normal.patches, EMPTY_CLOCK).ws;
    if (normal.dropped > 0) {
      audit(
        `Dropped ${normal.dropped} malformed patch(es) from a peer: ${normal.reasons.join(", ")}.`,
        { room: slug, from, dropped: normal.dropped },
      );
    }
  };

  const cancelBackup = (requester: string): void => {
    const timer = backups.get(requester);
    if (timer === undefined) return;
    clearTimeout(timer);
    backups.delete(requester);
  };

  /**
   * The freshest board answers, and an empty board never does. A joiner holding nothing
   * has nothing to say about the room, and saying it is how a full board gets emptied.
   */
  const answerNeed = (requester: string): void => {
    touchSelf();
    if (boardSize(store.get()) === 0) return;
    const best = presence.freshest(requester);
    if (best !== null && best.clientId === clientId) {
      sendState(requester);
      return;
    }
    if (backups.has(requester)) return;
    backups.set(
      requester,
      setTimeout(() => {
        backups.delete(requester);
        if (boardSize(store.get()) === 0) return;
        sendState(requester);
      }, ROOM_LIMITS.snapshotBackupMs),
    );
  };

  /**
   * A snapshot is merged into this board entity by entity, last writer wins. It never
   * replaces the store and it never removes anything: a peer holding categories the
   * sender has never seen keeps them, and the next flush sends them to the room.
   */
  const adoptState = (message: Extract<RoomMessage, { t: "state" }>): void => {
    state.adopted = true;
    state.settled = true;
    applyRemote(snapshotPatches(message.snapshot, message.from, message.at), message.from);
    scheduleSend();
  };

  const onMessage = (message: RoomMessage): void => {
    if (message.from === clientId || stopped) return;
    switch (message.t) {
      case "hello": {
        // Answer a peer we have not met, so both presence chips settle in one round trip
        // instead of waiting out a heartbeat.
        const known = presence.peer(message.from) !== null;
        presence.seen(message.peer, Date.now(), false);
        if (!known) announce();
        return;
      }
      case "bye":
        presence.forget(message.from);
        return;
      case "patch":
        applyRemote(message.patches, message.from);
        return;
      case "need":
        answerNeed(message.from);
        return;
      case "state":
        cancelBackup(message.to);
        if (message.to === clientId || message.to === BROADCAST_TO_ALL) adoptState(message);
        return;
      default:
        return;
    }
  };

  /* ---------- joining ---------- */

  const askForState = (): void => {
    if (stopped || state.adopted) return;
    if (state.asks >= SNAPSHOT_ATTEMPTS) {
      // Nobody answered, so this board is the room's board and its deletes are real.
      state.settled = true;
      return;
    }
    state.asks += 1;
    post({ t: "need", from: clientId, at: nowIso() });
    askTimer = setTimeout(askForState, ROOM_LIMITS.snapshotRetryMs);
  };

  /**
   * Joining runs once per open socket, and again after a reconnect. A reconnect replays
   * whatever was edited while the socket was down and asks for the room's state again,
   * so a browser that slept through a change is not left holding a stale board.
   */
  const onStatus = (next: RoomStatus): void => {
    presence.setStatus(next);
    if (next !== "open") {
      joined = false;
      return;
    }
    if (joined) return;
    joined = true;
    state.adopted = false;
    state.asks = 0;
    // A board with something on it is a source, not a joiner: it may delete from the
    // first message. An empty one waits until it knows what the room already holds.
    state.settled = boardSize(store.get()) > 0;
    announce();
    flush();
    askForState();
  };

  const unsubscribeStore = store.subscribe(scheduleSend);
  // One coercion point for the whole engine: what comes off the transport is unknown,
  // because an encrypted room carries envelopes and the wrapper hands back a plain object.
  const unsubscribeMessages = transport.onMessage((raw: unknown) => {
    const message = coerceMessage(raw);
    if (message !== null) onMessage(message);
  });
  const unsubscribeStatus = transport.onStatus(onStatus);

  touchSelf();
  transport.connect();
  if (transport.status() === "open") onStatus("open");
  heartbeat = setInterval(() => {
    presence.prune(Date.now());
    announce();
  }, ROOM_LIMITS.heartbeatMs);

  return {
    slug,
    clientId,
    kind: transport.kind,
    presence,
    joinUrl: () => roomJoinUrl(slug),
    status: () => transport.status(),
    unreadable: () => transport.unreadable?.() ?? 0,
    peers: () => presence.get(),
    setAgent(present: boolean): void {
      if (state.agent === present) return;
      state.agent = present;
      announce();
    },
    setLabel(label: string): void {
      state.label = label.slice(0, ROOM_LIMITS.labelChars);
      announce();
    },
    flush,
    stop(): void {
      if (stopped) return;
      flush();
      stopped = true;
      post({ t: "bye", from: clientId, at: nowIso() });
      unsubscribeStore();
      unsubscribeMessages();
      unsubscribeStatus();
      if (heartbeat !== null) clearInterval(heartbeat);
      if (askTimer !== null) clearTimeout(askTimer);
      for (const timer of backups.values()) clearTimeout(timer);
      backups.clear();
      transport.close();
      presence.setStatus("closed");
    },
  };
}
