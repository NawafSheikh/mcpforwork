/**
 * Workspaces: more than one board in one browser, each saved under its own key.
 *
 * A board was always persisted, but there was only ever one of it, so "my invoices work"
 * and "the hiring review" had to be the same page. An entry here is a named board with
 * its own storage key; the directory says which one is open and what the others hold, so
 * the picker can show real counts without loading five boards.
 */

/**
 * One saved workspace: a place people and their agents work together on one thing.
 *
 * The two numbers are what somebody scanning the list actually wants to know: how much
 * is on it, and how much is waiting on somebody. They are a cache of that board,
 * refreshed while it is open.
 */
export interface WorkspaceEntry {
  readonly id: string;
  readonly name: string;
  /** A line the person or the agent wrote about what this workspace is for. */
  readonly note?: string;
  readonly createdAt: string;
  /** The last time this board was written to storage, not the last time it changed. */
  readonly savedAt: string;
  /** Things being worked on here. */
  readonly work: number;
  /** Requests nobody has answered yet, in any of the four directions. */
  readonly requests: number;
}

export interface WorkspaceDirectory {
  readonly v: 1;
  /** The entry the page has open. Always the id of one of the entries. */
  readonly currentId: string;
  readonly entries: readonly WorkspaceEntry[];
}

/** What every controller call answers with, in words a person and an agent both read. */
export interface WorkspaceResult {
  readonly ok: boolean;
  readonly message: string;
  readonly entry?: WorkspaceEntry;
}

/** Whether what is on screen is on disk. "memory" means IndexedDB is not usable here. */
export type SaveState = "saved" | "saving" | "memory";

export const DIRECTORY_VERSION = 1 as const;

/** The board every visitor before workspaces already had; it keeps its old key. */
export const DEFAULT_WORKSPACE_ID = "local";
export const DEFAULT_WORKSPACE_NAME = "My workspace";

export const WORKSPACE_LIMITS = {
  maxWorkspaces: 24,
  maxNameChars: 60,
  maxNoteChars: 200,
} as const;
