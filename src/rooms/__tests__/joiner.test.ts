/**
 * The late joiner must never empty the room.
 *
 * Reproduces the 29 Aug 2026 incident on ?room=proofq7m2k4: a browser holding a full
 * board was joined by a fresh, empty peer, and the full board vanished on both sides.
 * The rules under test are the four the incident produced:
 *   1. a joiner never answers a snapshot request and never sends deletes for entities it
 *      has never seen;
 *   2. the snapshot comes from the peer with the most recent board, never an empty one;
 *   3. adopting a snapshot merges entity by entity and never resets the store;
 *   4. a peer holding entities the snapshot lacks keeps them, and the room gets them.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createMemoryHub } from "../transport";
import { startRoomSync, type RoomRuntime } from "../sync";
import { createPresenceController } from "../presence";
import { createWorkspaceStore, type PersistentWorkspaceStore } from "../../store";
import type { Category, Workspace } from "../../types";
import type { PeerInfo, RoomMessage } from "../types";

const T1 = "2026-08-29T10:00:00.000Z";
const SLUG = "proofq7m2k4";

function store(): PersistentWorkspaceStore {
  return createWorkspaceStore({ mode: "local", persist: false });
}

function category(name: string): Category {
  return { name, description: `${name} from the sample`, createdAt: T1 };
}

/** The board browser A had: four categories, an overview, a monitor and a draft. */
function fullBoard(ws: Workspace): Workspace {
  return {
    ...ws,
    categories: Object.fromEntries(
      ["Invoices", "Customer tickets", "Hiring", "Suppliers"].map((name) => [name, category(name)]),
    ),
    overview: { title: "Work overview", kpis: [{ label: "Categories", value: 4 }], charts: [], updatedAt: T1 },
    monitors: {
      mon_invoices: {
        id: "mon_invoices",
        name: "Invoice watch",
        category: "Invoices",
        schedule: "0 8 * * *",
        policy: { maxAutoActionsPerRun: 2 },
        runner: "local",
        status: "active",
        createdAt: T1,
      },
    },
    drafts: {
      draft_1: {
        id: "draft_1",
        monitorId: "mon_invoices",
        runId: "run_1",
        kind: "pay",
        target: "Acme Test Ltd",
        summary: "Pay invoice INV-2041",
        status: "held",
      },
    },
  };
}

type Hub = ReturnType<typeof createMemoryHub>;

interface Live {
  readonly hub: Hub;
  readonly storeA: PersistentWorkspaceStore;
  readonly storeB: PersistentWorkspaceStore;
  readonly roomA: RoomRuntime;
  readonly roomB: RoomRuntime;
  stop(): void;
}

/** A is already in the room with a full board; B joins it empty, exactly as it happened. */
async function joined(): Promise<Live> {
  const hub = createMemoryHub();
  const storeA = store();
  await storeA.update(fullBoard);
  const roomA = startRoomSync({
    store: storeA,
    slug: SLUG,
    clientId: "aaa1",
    label: "Ana",
    transport: hub.transport(SLUG),
  });
  roomA.flush();
  const storeB = store();
  const roomB = startRoomSync({
    store: storeB,
    slug: SLUG,
    clientId: "bbb2",
    label: "Ben",
    agent: true,
    transport: hub.transport(SLUG),
  });
  roomB.flush();
  return {
    hub,
    storeA,
    storeB,
    roomA,
    roomB,
    stop(): void {
      roomA.stop();
      roomB.stop();
      storeA.dispose();
      storeB.dispose();
    },
  };
}

let live: Live | null = null;
afterEach(() => {
  live?.stop();
  live = null;
});

const names = (ws: Workspace): readonly string[] => Object.keys(ws.categories).sort();

const from = (hub: Hub, clientId: string, kind: RoomMessage["t"]): readonly RoomMessage[] =>
  hub.sent.filter((message) => message.t === kind && message.from === clientId);

const deletes = (hub: Hub, clientId: string): number =>
  from(hub, clientId, "patch").reduce(
    (count, message) =>
      count + (message.t === "patch" ? message.patches.filter((patch) => patch.value === null).length : 0),
    0,
  );

/** How much board a state message is offering, counted the way a peer counts its own. */
function snapshotSize(message: RoomMessage): number {
  if (message.t !== "state") return 0;
  const snapshot = (message.snapshot ?? {}) as Record<string, unknown>;
  const count = (value: unknown): number =>
    typeof value === "object" && value !== null ? Object.keys(value).length : 0;
  return (
    count(snapshot.categories) +
    count(snapshot.monitors) +
    count(snapshot.drafts) +
    (snapshot.overview === undefined ? 0 : 1)
  );
}

const peer = (clientId: string, updatedAt: string, entities: number): PeerInfo => ({
  clientId,
  label: clientId,
  agent: false,
  updatedAt,
  entities,
});

describe("a fresh peer joining a room that already has a board", () => {
  it("adopts the board instead of emptying it", async () => {
    live = await joined();
    expect(names(live.storeB.get())).toHaveLength(4);
    expect(names(live.storeA.get())).toHaveLength(4);
    expect(live.storeA.get().overview?.title).toBe("Work overview");
    expect(Object.keys(live.storeA.get().monitors)).toHaveLength(1);
    expect(Object.keys(live.storeA.get().drafts)).toHaveLength(1);
  });

  it("keeps every category when the joiner then writes its own", async () => {
    live = await joined();
    await live.storeB.update((ws) => ({
      ...ws,
      categories: { ...ws.categories, Expenses: category("Expenses") },
    }));
    live.roomB.flush();
    expect(names(live.storeB.get())).toHaveLength(5);
    expect(names(live.storeA.get())).toHaveLength(5);
    expect(live.storeA.get().categories.Invoices?.name).toBe("Invoices");
  });

  it("never resets the board that was already there", async () => {
    live = await joined();
    expect(live.storeA.get().audit.some((event) => event.tool === "clear_workspace")).toBe(false);
    expect(names(live.storeA.get())).toContain("Hiring");
  });
});

describe("rule 1: a joiner never answers and never deletes what it has not seen", () => {
  it("does not answer a snapshot request while it holds nothing", () => {
    const hub = createMemoryHub();
    const empty = store();
    const emptyRoom = startRoomSync({
      store: empty,
      slug: SLUG,
      clientId: "eee1",
      transport: hub.transport(SLUG),
    });
    const wire = hub.transport(SLUG);
    wire.connect();
    wire.send({ t: "need", from: "xxx9", at: T1 });
    expect(from(hub, "eee1", "state")).toHaveLength(0);
    emptyRoom.stop();
    wire.close();
    empty.dispose();
  });

  it("never puts an empty board on the wire as the room's state", async () => {
    const hub = createMemoryHub();
    const empty = store();
    const emptyRoom = startRoomSync({
      store: empty,
      slug: SLUG,
      clientId: "eee1",
      transport: hub.transport(SLUG),
    });
    const full = store();
    await full.update(fullBoard);
    const fullRoom = startRoomSync({
      store: full,
      slug: SLUG,
      clientId: "fff2",
      transport: hub.transport(SLUG),
    });
    expect(hub.sent.filter((message) => message.t === "state" && snapshotSize(message) === 0)).toHaveLength(0);
    expect(names(full.get())).toHaveLength(4);
    expect(names(empty.get())).toHaveLength(4);
    emptyRoom.stop();
    fullRoom.stop();
    empty.dispose();
    full.dispose();
  });

  it("holds back deletes until it knows what the room holds", async () => {
    const hub = createMemoryHub();
    const joiner = store();
    const room = startRoomSync({
      store: joiner,
      slug: SLUG,
      clientId: "bbb2",
      transport: hub.transport(SLUG),
    });
    const wire = hub.transport(SLUG);
    wire.connect();
    wire.send({
      t: "patch",
      from: "aaa1",
      at: T1,
      patches: [{ kind: "category", key: "Invoices", value: category("Invoices"), at: T1, origin: "aaa1" }],
    });
    expect(joiner.get().categories.Invoices?.name).toBe("Invoices");
    await joiner.update((ws) => ({ ...ws, categories: {} }));
    room.flush();
    expect(deletes(hub, "bbb2")).toBe(0);
    room.stop();
    wire.close();
    joiner.dispose();
  });
});

describe("rule 2: the snapshot comes from the fullest, most recent board", () => {
  it("never picks a peer holding nothing, however recent it is", () => {
    const presence = createPresenceController(SLUG, "none");
    presence.seen(peer("empty", "2026-08-29T12:00:00.000Z", 0), 1, false);
    presence.seen(peer("full", "2026-08-29T11:00:00.000Z", 6), 1, false);
    expect(presence.freshest("me")?.clientId).toBe("full");
  });

  it("breaks a tie on the same stamp with the richer board", () => {
    const presence = createPresenceController(SLUG, "none");
    presence.seen(peer("thin", T1, 1), 1, false);
    presence.seen(peer("thick", T1, 9), 1, false);
    expect(presence.freshest("me")?.clientId).toBe("thick");
  });

  it("has nobody to answer when every peer is empty", () => {
    const presence = createPresenceController(SLUG, "none");
    presence.seen(peer("one", T1, 0), 1, false);
    expect(presence.freshest("me")).toBeNull();
  });
});

describe("rules 3 and 4: adopting merges, it never replaces", () => {
  it("keeps what the joiner already had and sends it to the room", async () => {
    const hub = createMemoryHub();
    const storeA = store();
    await storeA.update(fullBoard);
    const roomA = startRoomSync({
      store: storeA,
      slug: SLUG,
      clientId: "aaa1",
      transport: hub.transport(SLUG),
    });
    const storeB = store();
    await storeB.update((ws) => ({ ...ws, categories: { Expenses: category("Expenses") } }));
    const roomB = startRoomSync({
      store: storeB,
      slug: SLUG,
      clientId: "bbb2",
      transport: hub.transport(SLUG),
    });
    roomB.flush();
    roomA.flush();
    expect(names(storeB.get())).toContain("Expenses");
    expect(names(storeB.get())).toContain("Invoices");
    expect(names(storeA.get())).toContain("Expenses");
    expect(names(storeA.get())).toHaveLength(5);
    expect(deletes(hub, "bbb2")).toBe(0);
    roomA.stop();
    roomB.stop();
    storeA.dispose();
    storeB.dispose();
  });
});
