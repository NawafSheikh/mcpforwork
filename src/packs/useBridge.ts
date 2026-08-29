/**
 * useBridge(): the local bridge as React state.
 *
 * The session replaces its whole state object on every change, so a plain
 * useSyncExternalStore is stable here. Connecting is never automatic: the panel calls
 * connect() when a person switches Local bridge on.
 */

import { useCallback, useSyncExternalStore } from "react";
import { localBridge, type BridgeSession, type BridgeState } from "./bridgeSession";

export interface BridgeApi extends BridgeState {
  connect(): void;
  disconnect(): void;
  setPack(id: string, enabled: boolean): void;
}

export function useBridge(session: BridgeSession = localBridge()): BridgeApi {
  const subscribe = useCallback(
    (onChange: () => void) => session.subscribe(onChange),
    [session],
  );
  const snapshot = useCallback(() => session.get(), [session]);
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);

  const connect = useCallback(() => {
    void session.connect();
  }, [session]);
  const disconnect = useCallback(() => session.disconnect(), [session]);
  const setPack = useCallback(
    (id: string, enabled: boolean) => session.setPack(id, enabled),
    [session],
  );

  return { ...state, connect, disconnect, setPack };
}
