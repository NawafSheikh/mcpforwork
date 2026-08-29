/**
 * Who is in the public showcase room, without joining it.
 *
 * The landing page wants to say "3 people, 2 agents here" before a stranger clicks
 * anything, and it must not put a ghost peer in the room to find out. So this listens:
 * it opens the room's relay, reads the heartbeats every peer already broadcasts, and
 * never sends a message of its own. Nothing is applied to any board.
 *
 * Public rooms are unencrypted by design, which is what makes this readable at all.
 * If the browser has no relay, or nobody says hello inside the window, the card says so
 * instead of guessing.
 */
import { useEffect, useState } from "react";
import { ROOM_LIMITS, chooseTransport, coerceMessage, createRoomTransport } from "../../rooms";

export type ShowcaseStatus = "listening" | "seen" | "unknown";

export interface ShowcaseState {
  readonly status: ShowcaseStatus;
  readonly people: number;
  readonly agents: number;
}

export const SHOWCASE_IDLE: ShowcaseState = { status: "listening", people: 0, agents: 0 };

/** Long enough for two heartbeats, short enough that the card settles while reading. */
export const LISTEN_MS = ROOM_LIMITS.heartbeatMs * 2 + 1_000;

interface Seen {
  readonly agent: boolean;
  readonly at: number;
}

function count(seen: ReadonlyMap<string, Seen>, now: number): ShowcaseState {
  const live = [...seen.values()].filter((peer) => now - peer.at <= ROOM_LIMITS.peerTtlMs);
  if (live.length === 0) return { status: "unknown", people: 0, agents: 0 };
  return {
    status: "seen",
    people: live.length,
    agents: live.filter((peer) => peer.agent).length,
  };
}

/**
 * Listen to one public room. Returns the stop function; call it on unmount.
 * onState is called with every change, starting from "listening".
 */
export function watchShowcase(slug: string, onState: (state: ShowcaseState) => void): () => void {
  if (chooseTransport().kind === "none") {
    onState({ status: "unknown", people: 0, agents: 0 });
    return () => undefined;
  }
  const seen = new Map<string, Seen>();
  const transport = createRoomTransport(slug);
  const stopMessages = transport.onMessage((raw) => {
    const message = coerceMessage(raw);
    if (message === null || message.t !== "hello") return;
    seen.set(message.peer.clientId, { agent: message.peer.agent, at: Date.now() });
    onState(count(seen, Date.now()));
  });
  const settle = setTimeout(() => onState(count(seen, Date.now())), LISTEN_MS);
  transport.connect();
  return () => {
    clearTimeout(settle);
    stopMessages();
    transport.close();
  };
}

/** The same, as a hook, for the landing card. */
export function useShowcase(slug: string): ShowcaseState {
  const [state, setState] = useState<ShowcaseState>(SHOWCASE_IDLE);
  useEffect(() => {
    setState(SHOWCASE_IDLE);
    return watchShowcase(slug, setState);
  }, [slug]);
  return state;
}
