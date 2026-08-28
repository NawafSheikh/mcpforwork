/**
 * usePresence(): who is on this board, for the header chip.
 *
 * Two subscriptions, because both can change: the room runtime itself (create_room opens
 * one mid-session) and the presence inside it (peers arrive, leave and time out).
 * Snapshots are stable objects, so useSyncExternalStore does not re-render on every tick.
 */
import { useCallback, useSyncExternalStore } from "react";
import { IDLE_PRESENCE, presenceLabel, type PresenceState } from "./presence";
import { getRoomRuntime, subscribeRoomRuntime } from "./runtime";

function snapshot(): PresenceState {
  return getRoomRuntime()?.peers() ?? IDLE_PRESENCE;
}

export function usePresence(): PresenceState {
  const subscribe = useCallback((onChange: () => void) => {
    const listen = (): (() => void) =>
      getRoomRuntime()?.presence.subscribe(onChange) ?? ((): void => undefined);
    let stopPresence = listen();
    // A room can open mid-session (create_room), so re-point at the new presence store.
    const stopRuntime = subscribeRoomRuntime(() => {
      stopPresence();
      stopPresence = listen();
      onChange();
    });
    return () => {
      stopRuntime();
      stopPresence();
    };
  }, []);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** "2 people, 2 agents here". Same string the get_room tool reports. */
export function usePresenceLabel(): string {
  return presenceLabel(usePresence());
}
