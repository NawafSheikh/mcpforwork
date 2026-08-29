/**
 * Two browsers, one board, over a mock relay.
 *
 * createMemoryHub is the RoomTransport a Supabase channel would be: send goes to everyone
 * but the sender. Nothing here opens a socket, so nothing here talks to live Supabase.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createMemoryHub } from "../transport";
import { startRoomSync, type RoomRuntime } from "../sync";
import { createRoom, configureRooms, getRoomRuntime, isJoinFailure, leaveRoom } from "../runtime";
import { get_room, create_room } from "../handlers";
import { createWorkspaceStore, type PersistentWorkspaceStore } from "../../store";
import type { Category, Workspace } from "../../types";
import type { RoomMessage } from "../types";

const T1 = "2026-08-28T10:00:00.000Z";

function store(): PersistentWorkspaceStore {
  return createWorkspaceStore({ mode: "local", persist: false });
}

function category(name: string, description: string): Category {
  return { name, description, createdAt: T1 };
}

const addCategory = (name: string, description: string) => (ws: Workspace): Workspace => ({
  ...ws,
  categories: { ...ws.categories, [name]: category(name, description) },
});

interface Pair {
  readonly hub: ReturnType<typeof createMemoryHub>;
  readonly a: { store: PersistentWorkspaceStore; room: RoomRuntime };
  readonly b: { store: PersistentWorkspaceStore; room: RoomRuntime };
  stop(): void;
}

function pair(seed?: (ws: Workspace) => Workspace): Pair {
  const hub = createMemoryHub();
  const storeA = store();
  if (seed) void storeA.update(seed);
  const roomA = startRoomSync({ store: storeA, slug: "abc123", clientId: "aaa1", label: "Ana", transport: hub.transport("abc123") });
  const storeB = store();
  const roomB = startRoomSync({ store: storeB, slug: "abc123", clientId: "bbb2", label: "Ben", agent: true, transport: hub.transport("abc123") });
  return {
    hub,
    a: { store: storeA, room: roomA },
    b: { store: storeB, room: roomB },
    stop(): void {
      roomA.stop();
      roomB.stop();
      storeA.dispose();
      storeB.dispose();
    },
  };
}

let live: Pair | null = null;
afterEach(() => {
  live?.stop();
  live = null;
  configureRooms(null);
  leaveRoom();
});

const patchesFrom = (hub: Pair["hub"], clientId: string): readonly RoomMessage[] =>
  hub.sent.filter((message) => message.t === "patch" && message.from === clientId);

describe("a change on one browser reaches the other", () => {
  it("carries a new category across", async () => {
    live = pair();
    await live.a.store.update(addCategory("Invoices", "supplier invoices"));
    live.a.room.flush();
    expect(live.b.store.get().categories.Invoices?.description).toBe("supplier invoices");
  });

  it("carries a human approval and the audit line behind it", async () => {
    live = pair();
    await live.a.store.update((ws) => ({
      ...ws,
      drafts: {
        d1: {
          id: "d1",
          monitorId: "m1",
          runId: "r1",
          kind: "pay",
          target: "ACME",
          summary: "Pay invoice 88",
          status: "approved",
          decidedBy: "human",
          decidedAt: T1,
        },
      },
      audit: [{ id: "ev_h1", at: T1, actor: "human", tool: "approve_draft", result: "Approved d1", ok: true }],
    }));
    live.a.room.flush();
    expect(live.b.store.get().drafts.d1?.decidedBy).toBe("human");
    expect(live.b.store.get().audit.map((event) => event.id)).toContain("ev_h1");
  });

  it("removes on one side what was removed on the other", async () => {
    live = pair(addCategory("Invoices", "one"));
    live.a.room.flush();
    expect(live.b.store.get().categories.Invoices).toBeDefined();
    await live.a.store.update((ws) => ({ ...ws, categories: {} }));
    live.a.room.flush();
    expect(live.b.store.get().categories.Invoices).toBeUndefined();
  });
});

describe("loop prevention", () => {
  it("never echoes a patch back to the peer that sent it", async () => {
    live = pair();
    await live.a.store.update(addCategory("Invoices", "one"));
    live.a.room.flush();
    expect(live.b.store.get().categories.Invoices).toBeDefined();

    const before = patchesFrom(live.hub, "bbb2").length;
    live.b.room.flush();
    live.a.room.flush();
    live.b.room.flush();
    expect(patchesFrom(live.hub, "bbb2")).toHaveLength(before);
  });

  it("ignores a message stamped with this browser's own client id", async () => {
    live = pair();
    const start = live.a.store.get().categories;
    live.a.room.flush();
    expect(live.a.store.get().categories).toBe(start);
  });

  it("keeps a local edit that was still waiting when a remote patch landed", async () => {
    live = pair();
    await live.b.store.update(addCategory("Support", "mine"));
    await live.a.store.update(addCategory("Invoices", "theirs"));
    live.a.room.flush();
    live.b.room.flush();
    expect(live.a.store.get().categories.Support?.description).toBe("mine");
    expect(live.b.store.get().categories.Invoices?.description).toBe("theirs");
  });
});

describe("late joiners", () => {
  it("gets the whole board from the peer that already has one", () => {
    live = pair(addCategory("Invoices", "already here"));
    expect(live.b.store.get().categories.Invoices?.description).toBe("already here");
  });

  it("counts the people and the agents in the room on both sides", () => {
    live = pair();
    expect(live.a.room.peers().people).toBe(2);
    expect(live.b.room.peers().people).toBe(2);
    expect(live.a.room.peers().agents).toBe(1);
    expect(live.a.room.peers().peers.map((peer) => peer.label).sort()).toEqual(["Ana", "Ben"]);
  });

  it("drops a peer that says goodbye", () => {
    live = pair();
    live.b.room.stop();
    expect(live.a.room.peers().people).toBe(1);
  });
});

describe("a peer sending rubbish", () => {
  it("drops the patch, leaves the board alone and says so in the rail as the system", () => {
    live = pair();
    const hostile = live.hub.transport("abc123");
    hostile.connect();
    hostile.send({
      t: "patch",
      from: "evil",
      at: T1,
      patches: [
        { kind: "category", key: "Invoices", value: 42, at: T1, origin: "evil" },
        { kind: "category", key: "Support", value: { name: "Support" }, at: T1, origin: "evil" },
      ],
    });
    const board = live.a.store.get();
    expect(board.categories.Invoices).toBeUndefined();
    expect(board.categories.Support).toBeDefined();
    const dropped = board.audit.filter((event) => event.actor === "system" && event.tool === "room_sync");
    expect(dropped).toHaveLength(1);
    expect(dropped[0]?.result).toContain("category:Invoices");
    hostile.close();
  });
});

describe("the room tools", () => {
  it("says it is not in a room before one is opened", () => {
    expect(get_room({}, store().get()).result).toContain("Not in a room");
  });

  it("opens a room, returns a join link and reports it back through get_room", () => {
    const hub = createMemoryHub();
    const host = store();
    configureRooms({ store: host, label: "Ana", transport: (slug) => hub.transport(slug) });
    const opened = create_room({}, host.get());
    expect(opened.result).toContain("Send this link whole:");
    expect(opened.result).toContain("room=");
    expect(opened.next).toBeUndefined();

    const runtime = getRoomRuntime();
    expect(runtime).not.toBeNull();
    const reported = JSON.parse(get_room({}, host.get()).result) as { room: string; people: number };
    expect(reported.room).toBe(runtime?.slug);
    expect(reported.people).toBe(1);

    expect(create_room({}, host.get()).result).toContain("already room");
    host.dispose();
  });

  it("refuses politely when rooms are not configured in this build", () => {
    const opened = create_room({}, store().get());
    expect(opened.result).toContain("not switched on");
    expect(isJoinFailure(createRoom())).toBe(true);
  });
});
