/**
 * IndexedDB persistence for the workspace, with a memory only fallback.
 * Nothing here throws: when IndexedDB is missing or blocked the store keeps working
 * in memory and the caller is told through onError.
 */

import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import type { Workspace, WorkspaceMode } from "../types";

export type PersistenceError = (error: unknown, where: string) => void;

export interface Persistence {
  /** False when IndexedDB is unavailable, so the store is memory only. */
  readonly available: boolean;
  load(): Promise<unknown>;
  save(ws: Workspace): Promise<void>;
  clear(): Promise<void>;
}

export function workspaceKey(mode: WorkspaceMode): string {
  return `mfw:workspace:${mode}`;
}

/**
 * The key a board was saved under before the "demo" mode was renamed to "local".
 * Read once, on a first load that finds nothing, and never written back to.
 */
export function legacyWorkspaceKey(mode: WorkspaceMode): string | undefined {
  return mode === "local" ? "mfw:workspace:demo" : undefined;
}

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

export function createPersistence(
  key: string,
  enabled: boolean,
  onError?: PersistenceError,
  /** Read when the main key holds nothing, so a rename does not lose a board. */
  legacyKey?: string,
): Persistence {
  let usable = enabled && hasIndexedDb();
  const fail = (error: unknown, where: string): void => {
    usable = false;
    onError?.(error, where);
  };
  return {
    get available(): boolean {
      return usable;
    },
    async load(): Promise<unknown> {
      if (!usable) return undefined;
      try {
        const value = await idbGet(key);
        if (value !== undefined || legacyKey === undefined) return value;
        return await idbGet(legacyKey);
      } catch (error) {
        fail(error, "persist.load");
        return undefined;
      }
    },
    async save(ws: Workspace): Promise<void> {
      if (!usable) return;
      try {
        await idbSet(key, ws);
      } catch (error) {
        fail(error, "persist.save");
      }
    },
    async clear(): Promise<void> {
      if (!usable) return;
      try {
        await idbDel(key);
      } catch (error) {
        fail(error, "persist.clear");
      }
    },
  };
}
