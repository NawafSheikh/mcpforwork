/**
 * In-memory dataset registry (owner A11).
 *
 * This is deliberately the least durable thing in the app. Rows live in a Map on the
 * module, so they die with the tab: no IndexedDB, no localStorage, no Workspace, no
 * share URL, no tool result. Reload the page and the file is gone. That is the promise
 * the drop zone makes to the human, and this file is where it is kept.
 */

import type { DatasetProfile, DatasetTable, LoadedDataset } from "./types";

/** Enough for a demo or a real comparison, low enough that a tab cannot be filled. */
export const MAX_DATASETS = 8;

export interface DatasetRegistry {
  put(entry: LoadedDataset): void;
  /** The profile only. Callers that render or answer the agent use this. */
  profiles(): readonly DatasetProfile[];
  /** Rows. Only aggregate.ts and profile.ts should ever ask. */
  table(name: string): DatasetTable | undefined;
  find(name: string): LoadedDataset | undefined;
  forget(name: string): boolean;
  clear(): void;
  subscribe(listener: () => void): () => void;
  size(): number;
}

const normalise = (name: string): string => name.trim().toLowerCase();

export function createDatasetRegistry(max: number = MAX_DATASETS): DatasetRegistry {
  const entries = new Map<string, LoadedDataset>();
  let listeners: readonly (() => void)[] = [];

  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  const lookup = (name: string): LoadedDataset | undefined => {
    const key = normalise(name);
    const direct = entries.get(key);
    if (direct) return direct;
    for (const entry of entries.values()) {
      if (entry.profile.id === name) return entry;
    }
    return undefined;
  };

  return {
    put(entry: LoadedDataset): void {
      const key = normalise(entry.profile.name);
      if (!entries.has(key) && entries.size >= max) {
        const oldest = entries.keys().next();
        if (!oldest.done) entries.delete(oldest.value);
      }
      entries.set(key, entry);
      emit();
    },
    profiles: () => [...entries.values()].map((entry) => entry.profile),
    table: (name: string) => lookup(name)?.table,
    find: lookup,
    forget(name: string): boolean {
      const found = lookup(name);
      if (!found) return false;
      entries.delete(normalise(found.profile.name));
      emit();
      return true;
    },
    clear(): void {
      entries.clear();
      emit();
    },
    subscribe(listener: () => void): () => void {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((item) => item !== listener);
      };
    },
    size: () => entries.size,
  };
}

/** The one registry the page and the tools share. */
export const datasetMemory: DatasetRegistry = createDatasetRegistry();
