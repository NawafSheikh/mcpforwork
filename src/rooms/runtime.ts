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
import type { WorkspaceStore } from "../types";
import { mintRoomSlug, roomJoinUrl } from "./slug";
import { startRoomSync, type RoomRuntime } from "./sync";
import { chooseTransport } from "./transport";
import type { RoomTransport } from "./types";

export interface RoomHost {
  readonly store: WorkspaceStore;
  /** Self-reported presence label for this browser. */
  readonly label?: string;
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
const listeners = new Set<() => void>();

function publish(): void {
  for (const listener of [...listeners]) listener();
}

export function configureRooms(next: RoomHost | null): void {
  host = next;
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

export function joinRoom(slug: string): RoomRuntime | JoinFailure {
  if (host === null) return "unconfigured";
  if (runtime !== null && runtime.slug === slug) return runtime;
  runtime?.stop();
  const transport = host.transport?.(slug);
  if (transport === undefined && chooseTransport().kind === "none") return "no-transport";
  runtime = startRoomSync({
    store: host.store,
    slug,
    ...(host.label === undefined ? {} : { label: host.label }),
    ...(host.agent === undefined ? {} : { agent: host.agent }),
    ...(transport === undefined ? {} : { transport }),
  });
  host.onRoom?.(slug);
  publish();
  return runtime;
}

/** Mint a slug and join it. The current board becomes the room's opening state. */
export function createRoom(): RoomRuntime | JoinFailure {
  return joinRoom(mintRoomSlug());
}

export function leaveRoom(): void {
  if (runtime === null) return;
  runtime.stop();
  runtime = null;
  publish();
}

/** The link for a slug, without needing a live runtime. */
export function inviteUrl(slug: string): string {
  return roomJoinUrl(slug);
}

export function isJoinFailure(value: RoomRuntime | JoinFailure): value is JoinFailure {
  return typeof value === "string";
}
