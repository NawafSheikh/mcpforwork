/**
 * WorkspaceStore: one immutable Workspace, synchronous reads, debounced IndexedDB writes.
 * Updates never mutate; every update produces a new object and notifies subscribers
 * synchronously so React can render the same tick the agent's tool call lands.
 */

import { capAudit } from "./audit";
import { createPersistence, workspaceKey, type PersistenceError } from "./persist";
import type {
  AuditEvent,
  MonitorRun,
  OverviewSpec,
  Updater,
  Workspace,
  WorkspaceMode,
  WorkspaceStore,
} from "../types";

const DEBOUNCE_MS = 150;

export interface CreateStoreOptions {
  readonly mode: WorkspaceMode;
  /** Defaults to "mfw:workspace:<mode>". */
  readonly key?: string;
  /** Start from this workspace instead of an empty one. */
  readonly initial?: Workspace;
  /** Set false to stay in memory (tests, SSR). */
  readonly persist?: boolean;
  readonly debounceMs?: number;
  readonly onError?: PersistenceError;
}

/** WorkspaceStore plus the extras the shell needs: hydration promise and a flush. */
export interface PersistentWorkspaceStore extends WorkspaceStore {
  readonly key: string;
  readonly mode: WorkspaceMode;
  /** Resolves once the persisted workspace (if any) has been adopted. */
  readonly ready: Promise<Workspace>;
  /** True while IndexedDB is usable; false means memory only. */
  isPersistent(): boolean;
  flush(): Promise<void>;
  dispose(): void;
}

export function emptyWorkspace(mode: WorkspaceMode, at: string = new Date().toISOString()): Workspace {
  return {
    id: `mfw-${mode}`,
    name: mode === "demo" ? "Demo workspace" : "Live workspace",
    mode,
    categories: {},
    monitors: {},
    runs: [],
    drafts: {},
    feedback: {},
    audit: [],
    updatedAt: at,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accept a persisted value only when the shape still matches the contract. */
export function coerceWorkspace(raw: unknown, mode: WorkspaceMode): Workspace | null {
  if (!isRecord(raw)) return null;
  if (!isRecord(raw.categories) || !isRecord(raw.monitors) || !isRecord(raw.drafts)) return null;
  if (!Array.isArray(raw.runs) || !Array.isArray(raw.audit)) return null;
  const base = emptyWorkspace(mode);
  return {
    ...base,
    id: typeof raw.id === "string" ? raw.id : base.id,
    name: typeof raw.name === "string" ? raw.name : base.name,
    mode,
    categories: raw.categories as Workspace["categories"],
    overview: isRecord(raw.overview) ? (raw.overview as unknown as OverviewSpec) : undefined,
    monitors: raw.monitors as Workspace["monitors"],
    runs: raw.runs as readonly MonitorRun[],
    drafts: raw.drafts as Workspace["drafts"],
    audit: capAudit(raw.audit as readonly AuditEvent[]),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
  };
}

function normalize(ws: Workspace, at: string): Workspace {
  return { ...ws, audit: capAudit(ws.audit), updatedAt: at };
}

export function createWorkspaceStore(opts: CreateStoreOptions): PersistentWorkspaceStore {
  const key = opts.key ?? workspaceKey(opts.mode);
  const debounceMs = opts.debounceMs ?? DEBOUNCE_MS;
  const persistence = createPersistence(key, opts.persist !== false, opts.onError);
  const listeners = new Set<(ws: Workspace) => void>();

  let current = opts.initial ?? emptyWorkspace(opts.mode);
  let touched = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const notify = (ws: Workspace): void => {
    for (const listener of [...listeners]) {
      try {
        listener(ws);
      } catch (error) {
        opts.onError?.(error, "store.subscriber");
      }
    }
  };

  const cancelTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const flush = async (): Promise<void> => {
    cancelTimer();
    await persistence.save(current);
  };

  const schedule = (): void => {
    if (disposed || !persistence.available) return;
    cancelTimer();
    timer = setTimeout(() => {
      timer = null;
      void persistence.save(current);
    }, debounceMs);
  };

  const commit = (next: Workspace): Workspace => {
    touched = true;
    current = normalize(next, new Date().toISOString());
    notify(current);
    return current;
  };

  const hydrate = async (): Promise<Workspace> => {
    const restored = coerceWorkspace(await persistence.load(), opts.mode);
    if (restored !== null && !touched && !disposed) {
      current = restored;
      notify(current);
    }
    return current;
  };

  const ready = hydrate();

  return {
    key,
    mode: opts.mode,
    ready,
    isPersistent: () => persistence.available,
    get: () => current,
    async update(fn: Updater): Promise<Workspace> {
      const next = commit(fn(current));
      schedule();
      return next;
    },
    subscribe(listener: (ws: Workspace) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async reset(next?: Workspace): Promise<Workspace> {
      const value = commit(next ?? emptyWorkspace(opts.mode));
      await flush();
      return value;
    },
    flush,
    dispose(): void {
      disposed = true;
      cancelTimer();
      listeners.clear();
    },
  };
}
