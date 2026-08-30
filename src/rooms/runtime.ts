/**
 * One room per page, held here so a tool handler and a React chip see the same thing.
 *
 * The shell calls configureRooms once at bootstrap. Everything after that (create_room
 * from the agent, an Invite button from a human, ?room= in the URL) goes through join and
 * leave, and both a tool and the header read the current runtime from the same place.
 *
 * Re-keying persistence is not done here on purpose: the store owns its IndexedDB key, so
 * the host supplies an onRoom callback that updates the URL and moves the board across.
 */
import { buildInviteUrl, fingerprint, generateRoomSecret } from "../crypto";
import type { WorkspaceStore } from "../types";
import { mintRoomSlug, roomJoinUrl, roomStoreKey } from "./slug";
import { roomSecrets, sealedTransport } from "./sealed";
import { startRoomSync, type RoomRuntime } from "./sync";
import { chooseTransport, createRoomTransport } from "./transport";
import type { RoomTransport } from "./types";

export interface RoomHost {
  readonly store: WorkspaceStore;
  /** Self-reported presence label for this browser. */
  readonly label?: string;
  /**
   * The room key from the invite link, when this page was opened with one. Every room
   * this build opens is encrypted, so a room joined without a secret is a room this
   * browser cannot read: the shell shows the locked state instead of calling joinRoom.
   */
  readonly secret?: string;
  /** True when site tools registered here, so peers can count agents, not just people. */
  readonly agent?: boolean;
  /**
   * Called after a room opens. The shell updates the address bar to the join URL and
   * re-keys persistence to roomStoreKey(slug) so a reload lands back in the same room.
   */
  readonly onRoom?: (slug: string) => void;
  /** Injected relay, for tests and for a future Durable Object. */
  readonly transport?: (slug: string) => RoomTransport;
}

let host: RoomHost | null = null;
let runtime: RoomRuntime | null = null;
let secret: string | null = null;
let fp: string | null = null;
const listeners = new Set<() => void>();

function publish(): void {
  for (const listener of [...listeners]) listener();
}

/** Work out the fingerprint once and tell the chips, which is all it is for. */
function loadFingerprint(): void {
  fp = null;
  const current = secret;
  if (current === null) return;
  void fingerprint(current).then((value) => {
    if (secret !== current) return;
    fp = value;
    publish();
  });
}

export function configureRooms(next: RoomHost | null): void {
  host = next;
  secret = next?.secret ?? null;
  loadFingerprint();
}

/**
 * Change the name this browser is announced under, now and for any room opened later.
 *
 * The shell configures rooms once at bootstrap, when nobody has typed a name yet, so the
 * label captured there is the generic fallback. A person then types their name on the
 * landing card, and every room opened after that announced the fallback to everybody else
 * while rendering the real name locally, which means the one browser that could see the
 * mistake was the only one that never did. Found by running two machines against
 * production and reading the second one's members list.
 */
export function setRoomLabel(label: string): void {
  if (host === null) return;
  host = { ...host, label };
  runtime?.setLabel(label);
}

/** The room key this browser holds, or null on a board that is not in an encrypted room. */
export function roomSecret(): string | null {
  return secret;
}

/** The eight characters two people compare out loud. null until the digest resolves. */
export function roomFingerprint(): string | null {
  return fp;
}

/**
 * Where a room-scoped board is persisted. The key fingerprint is part of it, so the same
 * slug under a different key never reads back somebody else's board from IndexedDB.
 */
export async function roomStorageKey(slug: string): Promise<string> {
  const base = roomStoreKey(slug);
  const current = secret;
  if (current === null) return base;
  return `${base}:${fp ?? (await fingerprint(current))}`;
}

export function getRoomRuntime(): RoomRuntime | null {
  return runtime;
}

export function subscribeRoomRuntime(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Why a join failed, in a sentence a tool can hand straight back to the agent. */
export type JoinFailure = "unconfigured" | "no-transport";

/** The relay for this room, wrapped in the room key whenever this browser holds one. */
function transportFor(slug: string, injected: RoomTransport | undefined): RoomTransport {
  const base = injected ?? createRoomTransport(slug);
  return secret === null ? base : sealedTransport(base, roomSecrets(secret, slug));
}

export function joinRoom(slug: string): RoomRuntime | JoinFailure {
  if (host === null) return "unconfigured";
  if (runtime !== null && runtime.slug === slug) return runtime;
  runtime?.stop();
  const injected = host.transport?.(slug);
  if (injected === undefined && chooseTransport().kind === "none") return "no-transport";
  runtime = startRoomSync({
    store: host.store,
    slug,
    ...(host.label === undefined ? {} : { label: host.label }),
    ...(host.agent === undefined ? {} : { agent: host.agent }),
    transport: transportFor(slug, injected),
  });
  host.onRoom?.(slug);
  publish();
  return runtime;
}

/**
 * Mint a slug and a key, and join. The current board becomes the room's opening state and
 * the key never leaves this browser except inside the invite link somebody chooses to send.
 */
export function createRoom(): RoomRuntime | JoinFailure {
  secret = generateRoomSecret();
  loadFingerprint();
  const opened = joinRoom(mintRoomSlug());
  if (isJoinFailure(opened)) {
    secret = null;
    fp = null;
  }
  return opened;
}

export function leaveRoom(): void {
  if (runtime === null) return;
  runtime.stop();
  runtime = null;
  publish();
}

/** Tests only: forget the key this module is holding. */
export function resetRoomSecret(): void {
  secret = null;
  fp = null;
}

/**
 * The link a person sends. The slug is in the query so the app knows which room to open,
 * and the key is in the fragment, which no browser sends to a server.
 */
export function inviteUrl(slug: string): string {
  if (secret === null) return roomJoinUrl(slug);
  const here = (globalThis as { location?: { href?: string } }).location?.href ?? roomJoinUrl(slug);
  return buildInviteUrl(here, slug, secret, "write");
}

export function isJoinFailure(value: RoomRuntime | JoinFailure): value is JoinFailure {
  return typeof value === "string";
}
