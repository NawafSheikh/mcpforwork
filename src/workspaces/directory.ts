/**
 * The workspace directory: one small record in IndexedDB listing every saved board.
 *
 * Boards themselves are untouched by this file; each one keeps living under its own key
 * in src/store. The directory only says which keys exist, what they are called and which
 * one is open, so opening the picker never has to load a board to name it.
 *
 * Nothing here throws. A browser with no IndexedDB gets a directory in memory, which is
 * the same promise the store makes: the page keeps working, the saving stops.
 */

import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import {
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_NAME,
  DIRECTORY_VERSION,
  WORKSPACE_LIMITS,
  type WorkspaceDirectory,
  type WorkspaceEntry,
} from "./types";

export const DIRECTORY_KEY = "mfw:workspaces";

/**
 * The default workspace keeps the key every board used before this existed, so a visitor
 * who had work here finds it under "My workspace" instead of an empty page.
 */
export function boardKeyFor(id: string): string {
  return id === DEFAULT_WORKSPACE_ID ? "mfw:workspace:local" : `mfw:workspace:ws:${id}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed.slice(0, max);
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function coerceEntry(raw: unknown): WorkspaceEntry | null {
  if (!isRecord(raw)) return null;
  const id = text(raw.id, 40);
  const name = text(raw.name, WORKSPACE_LIMITS.maxNameChars);
  if (id === undefined || name === undefined) return null;
  const note = text(raw.note, WORKSPACE_LIMITS.maxNoteChars);
  const createdAt = text(raw.createdAt, 40) ?? new Date().toISOString();
  return {
    id,
    name,
    ...(note === undefined ? {} : { note }),
    createdAt,
    savedAt: text(raw.savedAt, 40) ?? createdAt,
    // `categories` is what an entry written before the rename called its work count.
    work: count(raw.work ?? raw.categories),
    requests: count(raw.requests),
  };
}

/** The entry every browser starts with, pointing at the board it already had. */
export function defaultEntry(at: string = new Date().toISOString()): WorkspaceEntry {
  return {
    id: DEFAULT_WORKSPACE_ID,
    name: DEFAULT_WORKSPACE_NAME,
    createdAt: at,
    savedAt: at,
    work: 0,
    requests: 0,
  };
}

/** A directory with one entry pointing at the board this browser already had. */
export function firstDirectory(at: string = new Date().toISOString()): WorkspaceDirectory {
  return { v: DIRECTORY_VERSION, currentId: DEFAULT_WORKSPACE_ID, entries: [defaultEntry(at)] };
}

/**
 * Read a stored directory back. Anything unreadable, empty, or pointing at an entry that
 * is not there is repaired rather than rejected: losing the list of boards would hide
 * boards that are still on disk.
 */
export function coerceDirectory(raw: unknown, at?: string): WorkspaceDirectory {
  if (!isRecord(raw) || !Array.isArray(raw.entries)) return firstDirectory(at);
  const entries = raw.entries
    .map(coerceEntry)
    .filter((entry): entry is WorkspaceEntry => entry !== null)
    .slice(0, WORKSPACE_LIMITS.maxWorkspaces);
  const head = entries[0];
  if (head === undefined) return firstDirectory(at);
  const wanted = text(raw.currentId, 40);
  const currentId =
    wanted !== undefined && entries.some((entry) => entry.id === wanted) ? wanted : head.id;
  return { v: DIRECTORY_VERSION, currentId, entries };
}

export function entryOf(directory: WorkspaceDirectory, id: string): WorkspaceEntry | null {
  return directory.entries.find((entry) => entry.id === id) ?? null;
}

export function currentEntry(directory: WorkspaceDirectory): WorkspaceEntry {
  return entryOf(directory, directory.currentId) ?? directory.entries[0] ?? defaultEntry();
}

/** Case and space insensitive, because a person types "Invoices " and means the same one. */
export function findEntry(directory: WorkspaceDirectory, idOrName: string): WorkspaceEntry | null {
  const wanted = idOrName.trim().toLowerCase();
  if (wanted.length === 0) return null;
  return (
    directory.entries.find((entry) => entry.id.toLowerCase() === wanted) ??
    directory.entries.find((entry) => entry.name.trim().toLowerCase() === wanted) ??
    null
  );
}

/** "Invoices", then "Invoices 2": two boards with one name would be unpickable. */
export function uniqueName(directory: WorkspaceDirectory, wanted: string, exceptId?: string): string {
  const taken = new Set(
    directory.entries
      .filter((entry) => entry.id !== exceptId)
      .map((entry) => entry.name.trim().toLowerCase()),
  );
  const base = wanted.trim().slice(0, WORKSPACE_LIMITS.maxNameChars) || DEFAULT_WORKSPACE_NAME;
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Date.now()}`;
}

/** Ids become storage keys, so they stay short, unique and free of anything path-like. */
export function newWorkspaceId(
  now: () => number = Date.now,
  random: () => number = Math.random,
): string {
  const stamp = now().toString(36).slice(-6);
  const noise = Math.floor(random() * 0x1000000)
    .toString(36)
    .padStart(4, "0")
    .slice(0, 4);
  return `${stamp}${noise}`;
}

export function upsertEntry(directory: WorkspaceDirectory, entry: WorkspaceEntry): WorkspaceDirectory {
  const known = directory.entries.some((item) => item.id === entry.id);
  const entries = known
    ? directory.entries.map((item) => (item.id === entry.id ? entry : item))
    : [...directory.entries, entry];
  return { ...directory, entries };
}

/** The last workspace is never removed: a person with no board has nowhere to be. */
export function removeEntry(directory: WorkspaceDirectory, id: string): WorkspaceDirectory {
  const entries = directory.entries.filter((entry) => entry.id !== id);
  const head = entries[0];
  if (head === undefined) return directory;
  const currentId = entries.some((entry) => entry.id === directory.currentId)
    ? directory.currentId
    : head.id;
  return { ...directory, currentId, entries };
}

export interface DirectoryStorage {
  readonly available: boolean;
  load(): Promise<WorkspaceDirectory>;
  save(directory: WorkspaceDirectory): Promise<void>;
  /** Drop the board behind an entry. The directory itself is written by save. */
  dropBoard(id: string): Promise<void>;
  /** Copy one board onto another key, which is what duplicate is made of. */
  copyBoard(fromId: string, toId: string): Promise<void>;
}

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/** IndexedDB when there is one, a memory directory when there is not. Never throws. */
export function createDirectoryStorage(enabled = true): DirectoryStorage {
  let usable = enabled && hasIndexedDb();
  let memory: WorkspaceDirectory | null = null;
  return {
    get available(): boolean {
      return usable;
    },
    async load(): Promise<WorkspaceDirectory> {
      if (!usable) return memory ?? firstDirectory();
      try {
        return coerceDirectory(await idbGet(DIRECTORY_KEY));
      } catch {
        usable = false;
        return firstDirectory();
      }
    },
    async save(directory: WorkspaceDirectory): Promise<void> {
      memory = directory;
      if (!usable) return;
      try {
        await idbSet(DIRECTORY_KEY, directory);
      } catch {
        usable = false;
      }
    },
    async dropBoard(id: string): Promise<void> {
      if (!usable) return;
      try {
        await idbDel(boardKeyFor(id));
      } catch {
        usable = false;
      }
    },
    async copyBoard(fromId: string, toId: string): Promise<void> {
      if (!usable) return;
      try {
        const board = await idbGet(boardKeyFor(fromId));
        if (board !== undefined) await idbSet(boardKeyFor(toId), board);
      } catch {
        usable = false;
      }
    },
  };
}
