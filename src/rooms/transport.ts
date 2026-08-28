/**
 * Picking a relay, and the two that need no picking.
 *
 * Order of preference: a configured Supabase Realtime channel (real multiplayer, across
 * machines), then BroadcastChannel (same browser profile only, honestly labelled), then
 * nothing at all, which still lets the board run as a single-player board.
 *
 * A Cloudflare Durable Object would land here as one more branch and one more file; the
 * sync engine never learns which one it got.
 */
import { createBroadcastTransport, hasBroadcastChannel } from "./broadcast";
import { createSupabaseTransport, supabaseRealtimeConfig, type SupabaseRealtimeConfig } from "./supabase";
import type { RoomMessage, RoomStatus, RoomTransport, RoomTransportKind } from "./types";

export interface TransportChoice {
  readonly kind: RoomTransportKind;
  /** One sentence a human can read in the UI. */
  readonly note: string;
}

function hasWebSocket(): boolean {
  return typeof (globalThis as { WebSocket?: unknown }).WebSocket === "function";
}

/** What this build would use, without opening anything. Drives the header copy. */
export function chooseTransport(config: SupabaseRealtimeConfig | null = supabaseRealtimeConfig()): TransportChoice {
  if (config !== null && hasWebSocket()) {
    return {
      kind: "supabase",
      note: "Rooms relay through a Supabase Realtime broadcast channel. The relay forwards patches and stores nothing: it has no table behind it.",
    };
  }
  if (hasBroadcastChannel()) {
    return {
      kind: "broadcast",
      note: "No relay configured, so this room is limited to tabs of this browser profile. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for real multiplayer.",
    };
  }
  return { kind: "none", note: "This browser cannot open a room: no WebSocket and no BroadcastChannel." };
}

/** A transport that goes nowhere, so the sync engine has no null branch to carry. */
export function createNullTransport(slug: string): RoomTransport {
  return {
    kind: "none",
    slug,
    connect: () => undefined,
    send: () => undefined,
    close: () => undefined,
    status: (): RoomStatus => "closed",
    onMessage: () => () => undefined,
    onStatus: () => () => undefined,
  };
}

export function createRoomTransport(
  slug: string,
  config: SupabaseRealtimeConfig | null = supabaseRealtimeConfig(),
): RoomTransport {
  const choice = chooseTransport(config);
  if (choice.kind === "supabase" && config !== null) return createSupabaseTransport(slug, config);
  if (choice.kind === "broadcast") return createBroadcastTransport(slug);
  return createNullTransport(slug);
}

/**
 * An in-process relay: every transport made by one hub sees every other one's messages.
 * Used by the tests as the transport mock, and by anyone who wants two boards side by
 * side in one page without a network.
 */
export function createMemoryHub(): { transport(slug: string): RoomTransport; sent: readonly RoomMessage[] } {
  const members = new Set<(message: RoomMessage) => void>();
  const sent: RoomMessage[] = [];
  return {
    sent,
    transport(slug: string): RoomTransport {
      const messageListeners = new Set<(message: RoomMessage) => void>();
      const statusListeners = new Set<(status: RoomStatus) => void>();
      let status: RoomStatus = "idle";
      const deliver = (message: RoomMessage): void => {
        for (const listener of [...messageListeners]) listener(message);
      };
      return {
        kind: "none",
        slug,
        connect(): void {
          members.add(deliver);
          status = "open";
          for (const listener of [...statusListeners]) listener(status);
        },
        send(message: RoomMessage): void {
          sent.push(message);
          const copy = JSON.parse(JSON.stringify(message)) as RoomMessage;
          for (const member of [...members]) {
            if (member !== deliver) member(copy);
          }
        },
        close(): void {
          members.delete(deliver);
          status = "closed";
          for (const listener of [...statusListeners]) listener(status);
        },
        status: () => status,
        onMessage(listener: (message: RoomMessage) => void): () => void {
          messageListeners.add(listener);
          return () => {
            messageListeners.delete(listener);
          };
        },
        onStatus(listener: (next: RoomStatus) => void): () => void {
          statusListeners.add(listener);
          return () => {
            statusListeners.delete(listener);
          };
        },
      };
    },
  };
}
