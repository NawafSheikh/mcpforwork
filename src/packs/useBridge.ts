/**
 * useBridge(): the local bridge as React state.
 *
 * The session replaces its whole state object on every change, so a plain
 * useSyncExternalStore is stable here. Connecting is never automatic: the panel calls
 * connect() when a person switches Local bridge on.
 */

import { useCallback, useSyncExternalStore } from "react";
import { localBridge, type BridgeSession, type BridgeState } from "./bridgeSession";
import type { CallOutcome } from "./bridge";

export interface BridgeApi extends BridgeState {
  connect(): void;
  disconnect(): void;
  setPack(id: string, enabled: boolean): void;
  /** Ask the machine something on a person's behalf. See BridgeSession.call. */
  call(tool: string, params?: unknown): Promise<CallOutcome>;
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
  const call = useCallback(
    (tool: string, params?: unknown) => session.call(tool, params),
    [session],
  );

  return { ...state, connect, disconnect, setPack, call };
}
