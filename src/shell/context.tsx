/** Shell context: the store, a live workspace snapshot and the WebMCP status. */
import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { Workspace, WorkspaceStore } from "../types";
import type { WebmcpStatus, WebmcpStatusStore } from "./adapters/webmcp";

export interface ShellValue {
  readonly store: WorkspaceStore;
  readonly statusStore: WebmcpStatusStore;
}

const ShellContext = createContext<ShellValue | null>(null);

export function ShellProvider({
  store,
  statusStore,
  children,
}: {
  readonly store: WorkspaceStore;
  readonly statusStore: WebmcpStatusStore;
  readonly children: ReactNode;
}): JSX.Element {
  return <ShellContext.Provider value={{ store, statusStore }}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell must be used inside ShellProvider");
  return value;
}

/** Live workspace snapshot. The store returns a new object on every change. */
export function useWorkspace(): Workspace {
  const { store } = useShell();
  const subscribe = useCallback(
    (onChange: () => void) => store.subscribe(() => onChange()),
    [store],
  );
  const snapshot = useCallback(() => store.get(), [store]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Registration is async, so the status arrives after the first paint. */
export function useWebmcpStatus(): WebmcpStatus {
  const { statusStore } = useShell();
  const subscribe = useCallback(
    (onChange: () => void) => statusStore.subscribe(onChange),
    [statusStore],
  );
  const snapshot = useCallback(() => statusStore.get(), [statusStore]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
