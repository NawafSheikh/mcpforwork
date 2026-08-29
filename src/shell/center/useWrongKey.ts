/**
 * Watching for a key that does not open the room.
 *
 * There is nothing to ask: the relay never says "wrong key", it just delivers envelopes
 * this browser cannot open. So the page counts them, waits the whole window, and only
 * then says so. A slow room and a wrong key look identical before that.
 */
import { useEffect, useState } from "react";
import { getRoomRuntime, usePresence } from "../../rooms";
import { useWorkspace } from "../context";
import { WRONG_KEY_MS } from "../lib/constants";
import { boardIsEmpty, isWrongKey } from "../lib/room";

const TICK_MS = 1_000;

export function useWrongKey(waitMs: number = WRONG_KEY_MS): boolean {
  const workspace = useWorkspace();
  const presence = usePresence();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    if (presence.slug === null) return undefined;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), TICK_MS);
    return () => clearInterval(timer);
  }, [presence.slug]);

  if (presence.slug === null) return false;
  return isWrongKey({
    unreadable: getRoomRuntime()?.unreadable() ?? 0,
    boardEmpty: boardIsEmpty(workspace),
    elapsedMs: elapsed,
    waitMs,
  });
}
