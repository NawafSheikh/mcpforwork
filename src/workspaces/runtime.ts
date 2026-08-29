/**
 * The workspace controller: create, switch, rename, duplicate, delete, save.
 *
 * One singleton, configured once at boot the way rooms are, because both the Tools panel
 * and the site tools have to act on the same list. Every method answers with a sentence,
 * so the button and the agent get the same words back and neither has to invent any.
 *
 * Saving is not a button that has to be pressed. A change to the board schedules a flush
 * to IndexedDB and stamps the entry, and the panel shows the state of that; the explicit
 * Save is there so a person can force it and be told, in words, what is now on disk.
 */

import { emptyWorkspace } from "../store";
import { DEFAULT_WORKSPACE_NAMES } from "../shell/lib/room";
import type { Updater, Workspace } from "../types";
import {
  boardKeyFor,
  createDirectoryStorage,
  currentEntry,
  entryOf,
  findEntry,
  firstDirectory,
  newWorkspaceId,
  removeEntry,
  uniqueName,
  upsertEntry,
  type DirectoryStorage,
} from "./directory";
import {
  WORKSPACE_LIMITS,
  type SaveState,
  type WorkspaceDirectory,
  type WorkspaceEntry,
  type WorkspaceResult,
} from "./types";

/** The slice of the store this needs. src/store's PersistentWorkspaceStore satisfies it. */
export interface WorkspaceHost {
  get(): Workspace;
  update(fn: Updater): Promise<Workspace>;
  subscribe(listener: (ws: Workspace) => void): () => void;
  open(key: string, fallback?: Workspace): Promise<Workspace>;
  flush(): Promise<void>;
}

export interface WorkspacesOptions {
  readonly store: WorkspaceHost;
  readonly storage?: DirectoryStorage;
  /** A room board belongs to the room, so switching away from one has to reload. */
  readonly inRoom?: () => boolean;
  /** How a reload happens. Injected so a test never navigates. */
  readonly navigate?: (url: string) => void;
  readonly saveDebounceMs?: number;
  readonly now?: () => Date;
}

export interface WorkspacesRuntime {
  /** Resolves once the directory has been read, so the first paint is not a guess. */
  readonly ready: Promise<WorkspaceDirectory>;
  directory(): WorkspaceDirectory;
  list(): readonly WorkspaceEntry[];
  current(): WorkspaceEntry;
  saveState(): SaveState;
  /**
   * The reason this board is not one of the saved workspaces right now, or null.
   * Set while the board is a shared room: a room board belongs to the room, and stamping
   * it into a workspace entry would rename and recount somebody else's board as if it
   * were yours. Switching out of a room is still allowed; it reloads onto the workspace.
   */
  heldByRoom(): string | null;
  create(input: { name: string; note?: string; activate?: boolean }): Promise<WorkspaceResult>;
  switchTo(idOrName: string): Promise<WorkspaceResult>;
  rename(name: string, id?: string): Promise<WorkspaceResult>;
  describe(note: string, id?: string): Promise<WorkspaceResult>;
  duplicate(id?: string, name?: string): Promise<WorkspaceResult>;
  remove(id: string): Promise<WorkspaceResult>;
  save(note?: string): Promise<WorkspaceResult>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

const SAVE_DEBOUNCE_MS = 600;

const ROOM_HELD =
  "This board is a shared room, so it is saved with the room rather than as one of your workspaces. Open one of your workspaces to leave the room, or leave the room link.";

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/** "3 categories, 1 monitor", the only summary the picker and the tools both need. */
export function entryLine(entry: WorkspaceEntry): string {
  const board =
    entry.categories === 0
      ? "empty"
      : `${plural(entry.categories, "category", "categories")}, ${plural(entry.monitors, "monitor", "monitors")}`;
  return entry.note === undefined ? board : `${board}, ${entry.note}`;
}

function blankBoard(name: string, at: string): Workspace {
  return { ...emptyWorkspace("local", at), name };
}

function countsOf(ws: Workspace): { categories: number; monitors: number } {
  return {
    categories: Object.keys(ws.categories).length,
    monitors: Object.keys(ws.monitors).length,
  };
}

export function createWorkspaces(options: WorkspacesOptions): WorkspacesRuntime {
  const storage = options.storage ?? createDirectoryStorage();
  const now = options.now ?? ((): Date => new Date());
  const stamp = (): string => now().toISOString();
  const debounceMs = options.saveDebounceMs ?? SAVE_DEBOUNCE_MS;
  const listeners = new Set<() => void>();

  let directory: WorkspaceDirectory = firstDirectory(stamp());
  let state: SaveState = "saved";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let switching = false;

  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  const heldByRoom = (): string | null => (options.inRoom?.() === true ? ROOM_HELD : null);
  const held = (): WorkspaceResult => ({ ok: false, message: ROOM_HELD });

  const setState = (next: SaveState): void => {
    if (state === next) return;
    state = next;
    notify();
  };

  const persist = async (next: WorkspaceDirectory): Promise<void> => {
    directory = next;
    notify();
    await storage.save(next);
  };

  /**
   * Pull the open board's name and counts into its entry, so the picker never lies.
   *
   * A board still carrying the name the store hands out is not a rename: it is a board
   * nobody has named. Adopting that would quietly retitle "Invoices" back to the default
   * every time a fresh board is in front of the store, so those names are left alone.
   */
  const refreshCurrent = (at: string = stamp()): WorkspaceDirectory => {
    const entry = currentEntry(directory);
    const ws = options.store.get();
    const counts = countsOf(ws);
    const board = ws.name.trim().slice(0, WORKSPACE_LIMITS.maxNameChars);
    const named = board.length > 0 && !DEFAULT_WORKSPACE_NAMES.includes(board);
    return upsertEntry(directory, {
      ...entry,
      ...counts,
      name: named ? board : entry.name,
      savedAt: at,
    });
  };

  const flushNow = async (): Promise<WorkspaceEntry> => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    await options.store.flush();
    const at = stamp();
    await persist(refreshCurrent(at));
    setState(storage.available ? "saved" : "memory");
    return currentEntry(directory);
  };

  const schedule = (): void => {
    if (disposed || switching) return;
    // A room board saves itself through the store under the room key; recording it here
    // would overwrite the workspace entry with a board that is not the workspace.
    if (heldByRoom() !== null) return;
    if (!storage.available) {
      setState("memory");
      return;
    }
    setState("saving");
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flushNow();
    }, debounceMs);
  };

  const stopStore = options.store.subscribe(() => schedule());

  const ready = (async (): Promise<WorkspaceDirectory> => {
    directory = await storage.load();
    if (!storage.available) state = "memory";
    notify();
    return directory;
  })();

  /** Point the store at another board and make its name agree with the entry. */
  const openBoard = async (entry: WorkspaceEntry): Promise<void> => {
    const opened = await options.store.open(boardKeyFor(entry.id), blankBoard(entry.name, stamp()));
    if (opened.name !== entry.name) {
      await options.store.update((ws) => ({ ...ws, name: entry.name }));
    }
  };

  const create: WorkspacesRuntime["create"] = async (input) => {
    await ready;
    if (heldByRoom() !== null) return held();
    if (directory.entries.length >= WORKSPACE_LIMITS.maxWorkspaces) {
      return {
        ok: false,
        message: `This browser already holds ${WORKSPACE_LIMITS.maxWorkspaces} workspaces, which is the limit. Delete one, or download a board as a file first.`,
      };
    }
    const at = stamp();
    const name = uniqueName(directory, input.name);
    const entry: WorkspaceEntry = {
      id: newWorkspaceId(),
      name,
      ...(input.note === undefined || input.note.trim().length === 0
        ? {}
        : { note: input.note.trim().slice(0, WORKSPACE_LIMITS.maxNoteChars) }),
      createdAt: at,
      savedAt: at,
      categories: 0,
      monitors: 0,
    };
    const activate = input.activate !== false;
    switching = activate;
    try {
      const withCurrent = activate ? refreshCurrent(at) : directory;
      const next = upsertEntry(withCurrent, entry);
      await persist(activate ? { ...next, currentId: entry.id } : next);
      if (activate) await openBoard(entry);
    } finally {
      switching = false;
    }
    if (activate) setState("saved");
    return {
      ok: true,
      entry,
      message: activate
        ? `Workspace "${entry.name}" is open and empty. Everything you build now lands here; the board you were on is saved and one click away in Workspaces.`
        : `Workspace "${entry.name}" saved. You are still on "${currentEntry(directory).name}"; call switch_workspace to move.`,
    };
  };

  const switchTo: WorkspacesRuntime["switchTo"] = async (idOrName) => {
    await ready;
    const entry = findEntry(directory, idOrName);
    if (entry === null) {
      const names = directory.entries.map((item) => item.name).join(", ");
      return { ok: false, message: `No workspace called "${idOrName}". This browser has: ${names}.` };
    }
    // In a room, even "switch to the one I am already on" is a move: it is the way out.
    const roomBoard = heldByRoom() !== null;
    if (!roomBoard && entry.id === directory.currentId) {
      return { ok: true, entry, message: `Already on "${entry.name}" (${entryLine(entry)}).` };
    }
    switching = true;
    try {
      // The room board is not this entry, so its counts and its name are not recorded.
      await persist({ ...(roomBoard ? directory : refreshCurrent()), currentId: entry.id });
      await options.store.flush();
      // A room board is the room's, not this browser's. Leaving one cleanly means
      // dropping the room from the address and starting again on the chosen workspace.
      if (roomBoard) {
        const url = `${window.location.origin}${window.location.pathname}`;
        (options.navigate ?? ((next: string) => window.location.assign(next)))(url);
        return {
          ok: true,
          entry,
          message: `Leaving the room and opening "${entry.name}". The room board stays where it is; open the room link again to come back.`,
        };
      }
      await openBoard(entry);
    } finally {
      switching = false;
    }
    setState("saved");
    return { ok: true, entry, message: `Now on "${entry.name}": ${entryLine(entry)}.` };
  };

  const rename: WorkspacesRuntime["rename"] = async (name, id) => {
    await ready;
    if (heldByRoom() !== null) return held();
    const target = id === undefined ? currentEntry(directory) : entryOf(directory, id);
    if (target === null) return { ok: false, message: `No workspace with id ${id}.` };
    const wanted = name.trim();
    if (wanted.length === 0) return { ok: false, message: "A workspace needs a name." };
    const next = uniqueName(directory, wanted, target.id);
    const entry = { ...target, name: next };
    await persist(upsertEntry(directory, entry));
    if (target.id === directory.currentId) {
      await options.store.update((ws) => ({ ...ws, name: next }));
    }
    return {
      ok: true,
      entry,
      message:
        next === wanted
          ? `Renamed to "${next}".`
          : `Renamed to "${next}"; "${wanted}" was already taken by another workspace here.`,
    };
  };

  const describe: WorkspacesRuntime["describe"] = async (note, id) => {
    await ready;
    if (heldByRoom() !== null) return held();
    const target = id === undefined ? currentEntry(directory) : entryOf(directory, id);
    if (target === null) return { ok: false, message: `No workspace with id ${id}.` };
    const trimmed = note.trim().slice(0, WORKSPACE_LIMITS.maxNoteChars);
    const entry: WorkspaceEntry =
      trimmed.length === 0 ? { ...target, note: undefined } : { ...target, note: trimmed };
    await persist(upsertEntry(directory, entry));
    return {
      ok: true,
      entry,
      message: trimmed.length === 0 ? `Note cleared on "${entry.name}".` : `"${entry.name}": ${trimmed}`,
    };
  };

  const duplicate: WorkspacesRuntime["duplicate"] = async (id, name) => {
    await ready;
    if (heldByRoom() !== null) return held();
    const source = id === undefined ? currentEntry(directory) : entryOf(directory, id);
    if (source === null) return { ok: false, message: `No workspace with id ${id}.` };
    if (directory.entries.length >= WORKSPACE_LIMITS.maxWorkspaces) {
      return { ok: false, message: `This browser already holds ${WORKSPACE_LIMITS.maxWorkspaces} workspaces, which is the limit.` };
    }
    if (source.id === directory.currentId) await flushNow();
    const at = stamp();
    const copy: WorkspaceEntry = {
      ...source,
      id: newWorkspaceId(),
      name: uniqueName(directory, `${source.name} copy`),
      createdAt: at,
      savedAt: at,
    };
    await storage.copyBoard(source.id, copy.id);
    const named = name === undefined ? copy : { ...copy, name: uniqueName(directory, name) };
    await persist(upsertEntry(directory, named));
    return {
      ok: true,
      entry: named,
      message: `Copied "${source.name}" to "${named.name}". You are still on "${currentEntry(directory).name}", so the copy stays as it is right now.`,
    };
  };

  const remove: WorkspacesRuntime["remove"] = async (id) => {
    await ready;
    if (heldByRoom() !== null) return held();
    const target = entryOf(directory, id);
    if (target === null) return { ok: false, message: `No workspace with id ${id}.` };
    if (directory.entries.length === 1) {
      return {
        ok: false,
        message: "This is the only workspace. Make another one first, or clear this board instead.",
      };
    }
    const next = removeEntry(directory, id);
    const moved = target.id === directory.currentId;
    await persist(next);
    await storage.dropBoard(id);
    if (moved) {
      switching = true;
      try {
        await openBoard(currentEntry(next));
      } finally {
        switching = false;
      }
    }
    return {
      ok: true,
      message: moved
        ? `Deleted "${target.name}". You are now on "${currentEntry(directory).name}".`
        : `Deleted "${target.name}".`,
    };
  };

  const save: WorkspacesRuntime["save"] = async (note) => {
    await ready;
    if (heldByRoom() !== null) return held();
    if (note !== undefined && note.trim().length > 0) await describe(note);
    const entry = await flushNow();
    if (!storage.available) {
      return {
        ok: false,
        entry,
        message: `"${entry.name}" is only in memory: this browser will not let the page store anything (a private window or blocked site data). Download the board as a file from Board, Backup.`,
      };
    }
    return {
      ok: true,
      entry,
      message: `Saved "${entry.name}" in this browser: ${entryLine(entry)}. It is here after a reload, and every later change saves itself.`,
    };
  };

  return {
    ready,
    directory: () => directory,
    list: () => directory.entries,
    current: () => currentEntry(directory),
    saveState: () => state,
    heldByRoom,
    create,
    switchTo,
    rename,
    describe,
    duplicate,
    remove,
    save,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose(): void {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      stopStore();
      listeners.clear();
    },
  };
}

let runtime: WorkspacesRuntime | null = null;

/** Called once at boot, from src/main.tsx, before anything renders. */
export function configureWorkspaces(options: WorkspacesOptions): WorkspacesRuntime {
  runtime?.dispose();
  runtime = createWorkspaces(options);
  return runtime;
}

/** Null on a shared snapshot and in any test that did not configure one. */
export function getWorkspaces(): WorkspacesRuntime | null {
  return runtime;
}

export function resetWorkspaces(): void {
  runtime?.dispose();
  runtime = null;
}
