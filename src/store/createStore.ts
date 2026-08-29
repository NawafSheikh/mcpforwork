/**
 * WorkspaceStore: one immutable Workspace, synchronous reads, debounced IndexedDB writes.
 * Updates never mutate; every update produces a new object and notifies subscribers
 * synchronously so React can render the same tick the agent's tool call lands.
 */

import { capAudit } from "./audit";
import {
  createPersistence,
  legacyWorkspaceKey,
  workspaceKey,
  type PersistenceError,
} from "./persist";
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
  /**
   * Point persistence at a different key and write the current board there at once.
   * Joining a room mid-session needs this: without it the board keeps saving under the
   * key it booted with, and a reload of the room URL reads a board frozen at join time.
   * A no-op when the key is unchanged, so re-keying to the key already in use cannot
   * clobber a hydration that is still in flight.
   */
  rekey(nextKey: string): Promise<void>;
  /**
   * Write the board under the key it is on, then point at another key and adopt whatever
   * is stored there. This is how a person moves between workspaces without a reload:
   * rekey carries the current board to a new key, open leaves it behind and loads another.
   * A key with nothing under it starts from `fallback`, or from an empty board.
   */
  open(nextKey: string, fallback?: Workspace): Promise<Workspace>;
  dispose(): void;
}

export function emptyWorkspace(mode: WorkspaceMode, at: string = new Date().toISOString()): Workspace {
  return {
    id: `mfw-${mode}`,
    // "My workspace" is also DEFAULT_WORKSPACE_NAME in src/workspaces/types.ts: the
    // board and its entry in the picker have to answer to the same name from the start.
    // The two are kept in step by a test rather than by an import, because the store
    // must not depend on the directory that lists it.
    name: mode === "local" ? "My workspace" : "Live workspace",
    mode,
    categories: {},
    monitors: {},
    runs: [],
    drafts: {},
    feedback: {},
    claims: {},
    lastWriter: {},
    packs: {},
    capabilities: {},
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
    feedback: isRecord(raw.feedback) ? (raw.feedback as Workspace["feedback"]) : {},
    claims: isRecord(raw.claims) ? (raw.claims as Workspace["claims"]) : {},
    lastWriter: isRecord(raw.lastWriter) ? (raw.lastWriter as Workspace["lastWriter"]) : {},
    packs: isRecord(raw.packs) ? (raw.packs as Workspace["packs"]) : {},
    capabilities: isRecord(raw.capabilities) ? (raw.capabilities as Workspace["capabilities"]) : {},
    audit: capAudit(raw.audit as readonly AuditEvent[]),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
  };
}

function normalize(ws: Workspace, at: string): Workspace {
  return { ...ws, audit: capAudit(ws.audit), updatedAt: at };
}

export function createWorkspaceStore(opts: CreateStoreOptions): PersistentWorkspaceStore {
  const debounceMs = opts.debounceMs ?? DEBOUNCE_MS;
  let key = opts.key ?? workspaceKey(opts.mode);
  const legacy = opts.key === undefined ? legacyWorkspaceKey(opts.mode) : undefined;
  let persistence = createPersistence(key, opts.persist !== false, opts.onError, legacy);
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

  const rekey = async (nextKey: string): Promise<void> => {
    if (disposed || nextKey === key) return;
    cancelTimer();
    key = nextKey;
    persistence = createPersistence(key, opts.persist !== false, opts.onError);
    await persistence.save(current);
  };

  const open = async (nextKey: string, fallback?: Workspace): Promise<Workspace> => {
    if (disposed) return current;
    // The first hydration must land before the board it hydrates is written anywhere,
    // or a switch made in the first tick saves an empty board over a real one.
    await ready;
    if (nextKey === key) return current;
    await flush();
    key = nextKey;
    persistence = createPersistence(key, opts.persist !== false, opts.onError);
    const restored = coerceWorkspace(await persistence.load(), opts.mode);
    // Not commit(): opening a board is not a change to it, so its updatedAt stands.
    touched = true;
    current = restored ?? fallback ?? emptyWorkspace(opts.mode);
    notify(current);
    await persistence.save(current);
    return current;
  };

  return {
    get key(): string {
      return key;
    },
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
    rekey,
    open,
    dispose(): void {
      disposed = true;
      cancelTimer();
      listeners.clear();
    },
  };
}
