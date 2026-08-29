/**
 * The React side of the workspace directory.
 *
 * useSyncExternalStore over the same runtime the site tools call, so a workspace the
 * agent creates appears in the panel in the same tick, and a switch a person makes is
 * the same code path the agent takes.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getWorkspaces, type WorkspacesRuntime } from "./runtime";
import { firstDirectory } from "./directory";
import type { SaveState, WorkspaceDirectory, WorkspaceEntry, WorkspaceResult } from "./types";

const EMPTY = firstDirectory();
const OFF: WorkspaceResult = {
  ok: false,
  message: "Workspaces are not available on this page.",
};

export interface WorkspacesApi {
  readonly entries: readonly WorkspaceEntry[];
  readonly current: WorkspaceEntry;
  readonly saveState: SaveState;
  /** False on a shared snapshot, where there is nothing of this browser's to switch to. */
  readonly available: boolean;
  /** Set while the board belongs to a room, with the sentence saying so. */
  readonly heldByRoom: string | null;
  create(name: string, note?: string): Promise<WorkspaceResult>;
  switchTo(id: string): Promise<WorkspaceResult>;
  rename(name: string, id?: string): Promise<WorkspaceResult>;
  duplicate(id?: string): Promise<WorkspaceResult>;
  remove(id: string): Promise<WorkspaceResult>;
  save(): Promise<WorkspaceResult>;
}

function subscribeTo(runtime: WorkspacesRuntime | null) {
  return (listener: () => void): (() => void) =>
    runtime === null ? () => undefined : runtime.subscribe(listener);
}

export function useWorkspaces(): WorkspacesApi {
  const runtime = getWorkspaces();
  const subscribe = useMemo(() => subscribeTo(runtime), [runtime]);
  const directory = useSyncExternalStore<WorkspaceDirectory>(
    subscribe,
    useCallback(() => runtime?.directory() ?? EMPTY, [runtime]),
    useCallback(() => runtime?.directory() ?? EMPTY, [runtime]),
  );
  const saveState = useSyncExternalStore<SaveState>(
    subscribe,
    useCallback(() => runtime?.saveState() ?? "memory", [runtime]),
    useCallback(() => runtime?.saveState() ?? "memory", [runtime]),
  );

  return useMemo<WorkspacesApi>(() => {
    const current =
      directory.entries.find((entry) => entry.id === directory.currentId) ??
      directory.entries[0] ??
      EMPTY.entries[0];
    return {
      entries: directory.entries,
      // EMPTY always carries one entry, so this is never undefined at runtime.
      current: current as WorkspaceEntry,
      saveState,
      available: runtime !== null,
      heldByRoom: runtime?.heldByRoom() ?? null,
      create: (name, note) =>
        runtime === null
          ? Promise.resolve(OFF)
          : runtime.create({ name, ...(note === undefined ? {} : { note }) }),
      switchTo: (id) => (runtime === null ? Promise.resolve(OFF) : runtime.switchTo(id)),
      rename: (name, id) => (runtime === null ? Promise.resolve(OFF) : runtime.rename(name, id)),
      duplicate: (id) => (runtime === null ? Promise.resolve(OFF) : runtime.duplicate(id)),
      remove: (id) => (runtime === null ? Promise.resolve(OFF) : runtime.remove(id)),
      save: () => (runtime === null ? Promise.resolve(OFF) : runtime.save()),
    };
  }, [directory, saveState, runtime]);
}
