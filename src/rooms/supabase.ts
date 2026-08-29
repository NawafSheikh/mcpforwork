/**
 * Supabase Realtime broadcast, hand rolled over a native WebSocket.
 *
 * Verified against the Realtime protocol docs (fetched 28 Aug 2026):
 * - the socket is wss://<ref>.supabase.co/realtime/v1/websocket?apikey=<anon>&vsn=1.0.0;
 * - protocol 1.0.0 frames are JSON objects {topic, event, payload, ref, join_ref};
 * - a channel is joined with phx_join and a config object; `private: false` is a public
 *   channel, which the docs describe as "anyone can subscribe without authentication",
 *   so the publishable/anon key is enough and no table and no RLS policy is involved;
 * - the heartbeat is {topic:"phoenix", event:"heartbeat", payload:{}} every 25 seconds;
 * - a broadcast is sent as event "broadcast" with payload {type:"broadcast", event, payload}.
 *
 * Free plan ceilings that shaped ROOM_LIMITS: 200 concurrent clients, 100 channel joins
 * per second, 100 messages per second, and a 256 KB maximum broadcast payload.
 *
 * Nothing is stored. Broadcast messages are ephemeral fan-out; the board only ever exists
 * in the browsers that are in the room. That is the honest version of "the relay never
 * keeps your board", and it is true because there is no table behind this channel.
 *
 * No SDK: this is roughly sixty lines of JSON framing, against a dependency that would
 * pull the whole supabase-js client into the bundle for the same three frame shapes.
 */
import { ROOM_LIMITS, type RoomMessage, type RoomStatus, type RoomTransport } from "./types";
import { coerceMessage } from "./wire";

const HEARTBEAT_MS = 25_000;
const RECONNECT_MS = 1_000;
const RECONNECT_MAX_MS = 15_000;
/** Two refused sockets is enough to stop calling it "connecting" and start calling it broken. */
const FAILED_ATTEMPTS_BEFORE_ERROR = 2;
/** One broadcast event name for the whole protocol; our own `t` field does the routing. */
const EVENT = "mfw";

export interface SupabaseRealtimeConfig {
  readonly url: string;
  readonly anonKey: string;
}

/** Same env names live mode already uses (src/live/auth.ts, docs/DEPLOY.md). */
export function supabaseRealtimeConfig(): SupabaseRealtimeConfig | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const url = (env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const anonKey = env.VITE_SUPABASE_ANON_KEY ?? "";
  return url.length > 0 && anonKey.length > 0 ? { url, anonKey } : null;
}

/** Channel topic. Namespaced so a room slug can never collide with another app's topic. */
export function roomTopic(slug: string): string {
  return `realtime:mfw-room-${slug}`;
}

export function realtimeSocketUrl(config: SupabaseRealtimeConfig): string {
  const base = config.url.replace(/^http/, "ws");
  return `${base}/realtime/v1/websocket?apikey=${encodeURIComponent(config.anonKey)}&vsn=1.0.0`;
}

export function joinFrame(topic: string, ref: string): string {
  return JSON.stringify({
    topic,
    event: "phx_join",
    payload: {
      config: {
        broadcast: { ack: false, self: false },
        presence: { enabled: false },
        private: false,
      },
    },
    ref,
    join_ref: ref,
  });
}

export function heartbeatFrame(ref: string): string {
  return JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref });
}

export function broadcastFrame(topic: string, ref: string, message: unknown): string {
  return JSON.stringify({
    topic,
    event: "broadcast",
    payload: { type: "broadcast", event: EVENT, payload: message },
    ref,
  });
}

interface Frame {
  readonly topic?: unknown;
  readonly event?: unknown;
  readonly payload?: unknown;
}

/**
 * What one of our broadcast frames is carrying, or null when the frame is not ours. It is
 * returned raw because an encrypted room carries a sealed envelope here, and only the
 * transport wrapper above can turn that back into something with a `t` on it.
 */
export function readFramePayload(raw: string, topic: string): unknown | null {
  let frame: Frame;
  try {
    frame = JSON.parse(raw) as Frame;
  } catch {
    return null;
  }
  if (frame.topic !== topic || frame.event !== "broadcast") return null;
  const payload = frame.payload;
  if (typeof payload !== "object" || payload === null) return null;
  const inner = payload as { event?: unknown; payload?: unknown };
  return inner.event === EVENT ? inner.payload ?? null : null;
}

/** The same frame, coerced into a RoomMessage. Kept for callers that speak plain rooms. */
export function readFrame(raw: string, topic: string, now: Date = new Date()): RoomMessage | null {
  const payload = readFramePayload(raw, topic);
  return payload === null ? null : coerceMessage(payload, now);
}

type SocketFactory = (url: string) => WebSocket;

export interface SupabaseTransportOptions {
  /** Injected in tests; defaults to the platform WebSocket. */
  readonly socketFactory?: SocketFactory;
}

/**
 * A reconnecting channel. Every method is fire and forget: send on a closed socket is a
 * no-op rather than a throw, because a dropped patch is recoverable and a thrown error
 * inside a store subscriber is not.
 */
export function createSupabaseTransport(
  slug: string,
  config: SupabaseRealtimeConfig,
  options: SupabaseTransportOptions = {},
): RoomTransport {
  const topic = roomTopic(slug);
  const messageListeners = new Set<(message: unknown) => void>();
  const statusListeners = new Set<(status: RoomStatus) => void>();
  const factory = options.socketFactory ?? ((url: string) => new WebSocket(url));

  let socket: WebSocket | null = null;
  let status: RoomStatus = "idle";
  let ref = 0;
  let attempts = 0;
  let stopped = false;
  let everOpen = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const nextRef = (): string => {
    ref += 1;
    return String(ref);
  };

  const setStatus = (next: RoomStatus): void => {
    if (next === status) return;
    status = next;
    for (const listener of [...statusListeners]) listener(next);
  };

  const clearTimers = (): void => {
    if (heartbeat !== null) clearInterval(heartbeat);
    if (retry !== null) clearTimeout(retry);
    heartbeat = null;
    retry = null;
  };

  const push = (frame: string): void => {
    if (socket === null || socket.readyState !== 1) return;
    try {
      socket.send(frame);
    } catch {
      setStatus("error");
    }
  };

  const scheduleReconnect = (): void => {
    if (stopped || retry !== null) return;
    attempts += 1;
    const wait = Math.min(RECONNECT_MS * 2 ** (attempts - 1), RECONNECT_MAX_MS);
    retry = setTimeout(() => {
      retry = null;
      open();
    }, wait + Math.floor(Math.random() * 250));
  };

  function open(): void {
    if (stopped || socket !== null) return;
    setStatus("connecting");
    let created: WebSocket;
    try {
      created = factory(realtimeSocketUrl(config));
    } catch {
      setStatus("error");
      scheduleReconnect();
      return;
    }
    socket = created;
    created.onopen = (): void => {
      attempts = 0;
      everOpen = true;
      push(joinFrame(topic, nextRef()));
      heartbeat = setInterval(() => push(heartbeatFrame(nextRef())), HEARTBEAT_MS);
      setStatus("open");
    };
    created.onmessage = (event: MessageEvent): void => {
      if (typeof event.data !== "string") return;
      const payload = readFramePayload(event.data, topic);
      if (payload === null) return;
      for (const listener of [...messageListeners]) listener(payload);
    };
    created.onerror = (): void => setStatus("error");
    created.onclose = (): void => {
      socket = null;
      clearTimers();
      // A socket that has never once opened is not "connecting", it is refused: a wrong
      // URL, a dead project, or a Content Security Policy without wss: in connect-src.
      // Saying "connecting" forever made a blocked relay look exactly like an empty room,
      // which is how a CSP block survived a live test. It reconnects either way.
      const refused = !everOpen && attempts >= FAILED_ATTEMPTS_BEFORE_ERROR;
      setStatus(stopped ? "closed" : refused ? "error" : "connecting");
      scheduleReconnect();
    };
  }

  return {
    kind: "supabase",
    slug,
    connect: open,
    status: () => status,
    send(message: unknown): void {
      const frame = broadcastFrame(topic, nextRef(), message);
      if (frame.length <= ROOM_LIMITS.maxMessageBytes * 2) push(frame);
    },
    close(): void {
      stopped = true;
      clearTimers();
      const current = socket;
      socket = null;
      setStatus("closed");
      try {
        current?.close();
      } catch {
        // A socket that refuses to close politely is already gone.
      }
    },
    onMessage(listener: (message: unknown) => void): () => void {
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
}
