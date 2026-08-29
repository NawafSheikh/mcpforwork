/**
 * Workspaces: the directory, the controller and the five tools.
 *
 * jsdom has no IndexedDB, so both the boards and the directory are faked with maps that
 * behave the way the real storage does. What is under test is the rule set, not idb:
 * a board that is left is written before another is opened, a name is never duplicated,
 * the last workspace cannot be deleted, and no tool can delete one at all.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceStore, emptyWorkspace } from "../../store";
import type { Workspace } from "../../types";
import {
  boardKeyFor,
  coerceDirectory,
  currentEntry,
  findEntry,
  firstDirectory,
  removeEntry,
  uniqueName,
  upsertEntry,
  type DirectoryStorage,
} from "../directory";
import { configureWorkspaces, createWorkspaces, entryLine, resetWorkspaces } from "../runtime";
import type { WorkspaceHost } from "../runtime";
import { savedLabel } from "../ui/savedLabel";
import {
  WORKSPACE_TOOL_NAMES,
  setWorkspaceRoomCheck,
  workspaceToolHandlers,
} from "../tools";
import {
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_NAME,
  type WorkspaceDirectory,
} from "../types";

/** A store that keeps one board per key, which is what IndexedDB does for the real one. */
function fakeHost(): WorkspaceHost & {
  readonly boards: Map<string, Workspace>;
  key(): string;
  set(next: Workspace): void;
} {
  const boards = new Map<string, Workspace>();
  const listeners = new Set<(ws: Workspace) => void>();
  let key = boardKeyFor(DEFAULT_WORKSPACE_ID);
  let current: Workspace = emptyWorkspace("local");
  const notify = (): void => {
    for (const listener of [...listeners]) listener(current);
  };
  return {
    boards,
    key: () => key,
    set(next: Workspace): void {
      current = next;
      notify();
    },
    get: () => current,
    async update(fn): Promise<Workspace> {
      current = fn(current);
      notify();
      return current;
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async flush(): Promise<void> {
      boards.set(key, current);
    },
    async open(nextKey, fallback): Promise<Workspace> {
      boards.set(key, current);
      key = nextKey;
      current = boards.get(nextKey) ?? fallback ?? emptyWorkspace("local");
      notify();
      return current;
    },
  };
}

function fakeStorage(boards: Map<string, Workspace>): DirectoryStorage {
  let saved: WorkspaceDirectory = firstDirectory();
  return {
    available: true,
    async load(): Promise<WorkspaceDirectory> {
      return saved;
    },
    async save(directory): Promise<void> {
      saved = directory;
    },
    async dropBoard(id): Promise<void> {
      boards.delete(boardKeyFor(id));
    },
    async copyBoard(from, to): Promise<void> {
      const board = boards.get(boardKeyFor(from));
      if (board !== undefined) boards.set(boardKeyFor(to), board);
    },
  };
}

function withCategory(ws: Workspace, name: string): Workspace {
  return {
    ...ws,
    categories: { ...ws.categories, [name]: { name, updatedAt: ws.updatedAt } as never },
  };
}

function runtimeFor() {
  const host = fakeHost();
  const runtime = createWorkspaces({
    store: host,
    storage: fakeStorage(host.boards),
    saveDebounceMs: 1,
  });
  return { host, runtime };
}

describe("the directory", () => {
  it("calls a fresh board what the picker calls it", () => {
    // Kept in step by hand: the store cannot import the directory that lists it, so a
    // change to one of these two names has to be a change to both.
    expect(emptyWorkspace("local").name).toBe(DEFAULT_WORKSPACE_NAME);
  });

  it("keeps the old key for the board every browser already had", () => {
    expect(boardKeyFor(DEFAULT_WORKSPACE_ID)).toBe("mfw:workspace:local");
    expect(boardKeyFor("ab12cd")).toBe("mfw:workspace:ws:ab12cd");
  });

  it("repairs anything unreadable rather than dropping boards on the floor", () => {
    expect(coerceDirectory(null).entries).toHaveLength(1);
    expect(coerceDirectory({ entries: [] }).entries).toHaveLength(1);
    const stray = coerceDirectory({
      entries: [{ id: "a", name: "A", createdAt: "2026-08-29T00:00:00.000Z" }],
      currentId: "gone",
    });
    expect(stray.currentId).toBe("a");
    expect(stray.entries[0]?.savedAt).toBe("2026-08-29T00:00:00.000Z");
  });

  it("never lets two workspaces answer to one name", () => {
    const one = firstDirectory();
    expect(uniqueName(one, "My workspace")).toBe("My workspace 2");
    expect(uniqueName(one, "My workspace", DEFAULT_WORKSPACE_ID)).toBe("My workspace");
    expect(uniqueName(one, "Invoices")).toBe("Invoices");
  });

  it("finds a workspace by id or by the name a person would type", () => {
    const dir = upsertEntry(firstDirectory(), {
      id: "x1",
      name: "Invoices",
      createdAt: "t",
      savedAt: "t",
      categories: 2,
      monitors: 0,
    });
    expect(findEntry(dir, "x1")?.name).toBe("Invoices");
    expect(findEntry(dir, "  invoices ")?.id).toBe("x1");
    expect(findEntry(dir, "nothing")).toBeNull();
  });

  it("refuses to remove the last workspace", () => {
    const one = firstDirectory();
    expect(removeEntry(one, DEFAULT_WORKSPACE_ID)).toBe(one);
  });

  it("says what a workspace holds in words, not in a schema", () => {
    const base = currentEntry(firstDirectory());
    expect(entryLine(base)).toBe("empty");
    expect(entryLine({ ...base, categories: 3, monitors: 1 })).toBe("3 categories, 1 monitor");
    expect(entryLine({ ...base, categories: 1, monitors: 0, note: "Q3 only" })).toBe(
      "1 category, 0 monitors, Q3 only",
    );
  });
});

describe("the controller", () => {
  it("opens a new workspace on an empty board and leaves the old one saved", async () => {
    const { host, runtime } = runtimeFor();
    await runtime.ready;
    host.set(withCategory(host.get(), "Invoices"));

    const made = await runtime.create({ name: "Hiring" });

    expect(made.ok).toBe(true);
    expect(Object.keys(host.get().categories)).toEqual([]);
    expect(host.get().name).toBe("Hiring");
    expect(runtime.current().name).toBe("Hiring");
    // The board that was left is on disk with its category still on it.
    expect(host.boards.get(boardKeyFor(DEFAULT_WORKSPACE_ID))?.categories).toHaveProperty("Invoices");
    runtime.dispose();
  });

  it("comes back to a board exactly as it was left", async () => {
    const { host, runtime } = runtimeFor();
    await runtime.ready;
    host.set(withCategory(host.get(), "Invoices"));
    await runtime.create({ name: "Hiring" });
    host.set(withCategory(host.get(), "Roles"));

    await runtime.switchTo("My workspace");

    expect(Object.keys(host.get().categories)).toEqual(["Invoices"]);
    expect(runtime.current().name).toBe("My workspace");

    await runtime.switchTo("Hiring");
    expect(Object.keys(host.get().categories)).toEqual(["Roles"]);
    runtime.dispose();
  });

  it("names the workspaces it has when asked for one it does not", async () => {
    const { runtime } = runtimeFor();
    await runtime.ready;

    const missed = await runtime.switchTo("Nope");

    expect(missed.ok).toBe(false);
    expect(missed.message).toContain("My workspace");
    runtime.dispose();
  });

  it("renames the workspace and the board together", async () => {
    const { host, runtime } = runtimeFor();
    await runtime.ready;

    await runtime.rename("Supplier invoices");

    expect(runtime.current().name).toBe("Supplier invoices");
    expect(host.get().name).toBe("Supplier invoices");
    runtime.dispose();
  });

  it("copies a board without moving the person off the one they are on", async () => {
    const { host, runtime } = runtimeFor();
    await runtime.ready;
    host.set(withCategory(host.get(), "Invoices"));

    const copy = await runtime.duplicate();

    expect(copy.ok).toBe(true);
    expect(copy.entry?.name).toBe("My workspace copy");
    expect(runtime.current().name).toBe("My workspace");
    expect(host.boards.get(boardKeyFor(copy.entry?.id ?? ""))?.categories).toHaveProperty("Invoices");
    runtime.dispose();
  });

  it("refuses to delete the only workspace, and moves you off one it does delete", async () => {
    const { runtime } = runtimeFor();
    await runtime.ready;

    expect((await runtime.remove(DEFAULT_WORKSPACE_ID)).ok).toBe(false);

    const made = await runtime.create({ name: "Hiring" });
    const gone = await runtime.remove(made.entry?.id ?? "");

    expect(gone.ok).toBe(true);
    expect(runtime.current().name).toBe("My workspace");
    expect(runtime.list()).toHaveLength(1);
    runtime.dispose();
  });

  it("records nothing about a board that belongs to a room, and still lets you leave", async () => {
    const host = fakeHost();
    const navigated: string[] = [];
    const runtime = createWorkspaces({
      store: host,
      storage: fakeStorage(host.boards),
      saveDebounceMs: 1,
      inRoom: () => true,
      navigate: (url) => navigated.push(url),
    });
    await runtime.ready;
    host.set({ ...withCategory(host.get(), "Somebody else's"), name: "Q3 close" });

    expect(runtime.heldByRoom()).not.toBeNull();
    expect((await runtime.save()).ok).toBe(false);
    expect((await runtime.rename("Mine now")).ok).toBe(false);
    expect((await runtime.create({ name: "Hiring" })).ok).toBe(false);
    // The room board did not rename or recount the workspace it was opened from.
    expect(runtime.current().name).toBe("My workspace");
    expect(runtime.current().categories).toBe(0);

    const out = await runtime.switchTo("My workspace");

    expect(out.ok).toBe(true);
    expect(navigated).toHaveLength(1);
    runtime.dispose();
  });

  it("saves on demand and counts what is actually stored", async () => {
    const { host, runtime } = runtimeFor();
    await runtime.ready;
    host.set(withCategory(host.get(), "Invoices"));

    const saved = await runtime.save("everything from the supplier mailbox");

    expect(saved.ok).toBe(true);
    expect(saved.message).toContain("1 category");
    expect(runtime.current().note).toBe("everything from the supplier mailbox");
    expect(runtime.saveState()).toBe("saved");
    runtime.dispose();
  });

  it("says so instead of pretending when the browser will not store anything", async () => {
    const host = fakeHost();
    const storage = { ...fakeStorage(host.boards), available: false };
    const runtime = createWorkspaces({ store: host, storage, saveDebounceMs: 1 });
    await runtime.ready;

    const saved = await runtime.save();

    expect(saved.ok).toBe(false);
    expect(saved.message).toContain("only in memory");
    expect(savedLabel("memory", saved.entry?.savedAt ?? "")).toBe(
      "Not saved: this browser blocks storage",
    );
    runtime.dispose();
  });
});

describe("the workspace tools", () => {
  beforeEach(() => {
    resetWorkspaces();
    setWorkspaceRoomCheck(() => false);
  });

  it("has no way for an agent to delete somebody's saved work", () => {
    expect(WORKSPACE_TOOL_NAMES).not.toContain("delete_workspace");
    expect(Object.keys(workspaceToolHandlers)).toHaveLength(5);
  });

  it("says workspaces are not here rather than throwing when none are configured", async () => {
    const answer = await workspaceToolHandlers.list_workspaces({}, emptyWorkspace("local"));
    expect(answer.result).toContain("not available");
  });

  it("lists, creates and switches through the same controller the panel uses", async () => {
    const host = fakeHost();
    const runtime = configureWorkspaces({
      store: host,
      storage: fakeStorage(host.boards),
      saveDebounceMs: 1,
    });
    await runtime.ready;

    await workspaceToolHandlers.create_workspace(
      { name: "Q3 hiring", note: "roles and candidates" },
      host.get(),
    );
    const listed = await workspaceToolHandlers.list_workspaces({}, host.get());
    const parsed = JSON.parse(listed.result) as {
      open: string;
      workspaces: { name: string; open: boolean; holds: string }[];
    };

    expect(parsed.open).toBe("Q3 hiring");
    expect(parsed.workspaces).toHaveLength(2);
    expect(parsed.workspaces.find((row) => row.open)?.holds).toContain("roles and candidates");

    const back = await workspaceToolHandlers.switch_workspace({ workspace: "My workspace" }, host.get());
    expect(back.result).toContain("My workspace");
    expect(runtime.current().name).toBe("My workspace");
    resetWorkspaces();
  });

  it("will not take an agent out of a room its people are working in", async () => {
    const host = fakeHost();
    const runtime = configureWorkspaces({
      store: host,
      storage: fakeStorage(host.boards),
      saveDebounceMs: 1,
    });
    await runtime.ready;
    await workspaceToolHandlers.create_workspace({ name: "Hiring" }, host.get());
    setWorkspaceRoomCheck(() => true);

    const refused = await workspaceToolHandlers.switch_workspace(
      { workspace: "My workspace" },
      host.get(),
    );

    expect(refused.result).toContain("shared room");
    expect(runtime.current().name).toBe("Hiring");
    resetWorkspaces();
  });
});

describe("opening another board in the store", () => {
  it("leaves the board it was on and adopts the one it is given", async () => {
    const store = createWorkspaceStore({ mode: "local", persist: false });
    await store.ready;
    const seen: string[] = [];
    store.subscribe((ws) => seen.push(ws.name));

    const opened = await store.open("mfw:workspace:ws:other", {
      ...emptyWorkspace("local"),
      name: "Hiring",
    });

    expect(opened.name).toBe("Hiring");
    expect(store.get().name).toBe("Hiring");
    expect(store.key).toBe("mfw:workspace:ws:other");
    expect(seen).toContain("Hiring");
    store.dispose();
  });

  it("is a no-op on the key it is already using, so nothing is reset by accident", async () => {
    const store = createWorkspaceStore({ mode: "local", persist: false, key: "k" });
    await store.update((ws) => ({ ...ws, name: "Invoices" }));

    await store.open("k", { ...emptyWorkspace("local"), name: "Wiped" });

    expect(store.get().name).toBe("Invoices");
    store.dispose();
  });
});
