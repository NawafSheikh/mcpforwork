/**
 * Who may move a switch.
 *
 * Outside a room, the person looking at the page. Inside one, the host: rooms exposes no
 * host yet, so the fallback is the first peer, and "first" has to mean the same thing in
 * every browser or two peers both think they decide.
 */
import { afterEach, describe, expect, it } from "vitest";
import { configureRooms, joinRoom, leaveRoom, isJoinFailure } from "../../rooms/runtime";
import { startRoomSync, type RoomRuntime } from "../../rooms/sync";
import { createMemoryHub } from "../../rooms/transport";
import { createWorkspaceStore, type PersistentWorkspaceStore } from "../../store";
import { createPackController } from "../controller";
import { firstPeerId, inRoom, maySwitchPacks, roomHostId, switchBlockedReason } from "../host";
import { packStateOf } from "../state";

const SLUG = "abc123";

interface Live {
  readonly store: PersistentWorkspaceStore;
  readonly room: RoomRuntime;
  readonly peer: RoomRuntime | null;
  readonly peerStore: PersistentWorkspaceStore | null;
}

let live: Live | null = null;

afterEach(() => {
  live?.peer?.stop();
  live?.peerStore?.dispose();
  leaveRoom();
  configureRooms(null);
  live?.store.dispose();
  live = null;
});

/** Join a room, then optionally put one more browser in it with a chosen client id. */
function room(peerId?: string): Live {
  const hub = createMemoryHub();
  const store = createWorkspaceStore({ mode: "demo", persist: false });
  configureRooms({ store, label: "Ana", transport: (slug) => hub.transport(slug) });
  const joined = joinRoom(SLUG);
  if (isJoinFailure(joined)) throw new Error(`could not open the test room: ${joined}`);
  if (peerId === undefined) {
    live = { store, room: joined, peer: null, peerStore: null };
    return live;
  }
  const peerStore = createWorkspaceStore({ mode: "demo", persist: false });
  const peer = startRoomSync({
    store: peerStore,
    slug: SLUG,
    clientId: peerId,
    label: "Ben",
    transport: hub.transport(SLUG),
  });
  live = { store, room: joined, peer, peerStore };
  return live;
}

describe("who may switch", () => {
  it("picks the same first peer in every browser", () => {
    expect(firstPeerId([{ clientId: "cbb" }, { clientId: "caa" }, { clientId: "czz" }])).toBe("caa");
    expect(firstPeerId([])).toBeNull();
  });

  it("lets the person decide on a board that is not in a room", async () => {
    const store = createWorkspaceStore({ mode: "demo", persist: false });
    const packs = createPackController(store);

    expect(inRoom()).toBe(false);
    expect(maySwitchPacks()).toBe(true);
    expect(switchBlockedReason()).toBe("");

    await packs.setPack("monitors", false);
    expect(packStateOf(store.get(), "monitors")?.enabled).toBe(false);
    store.dispose();
  });

  it("makes the only browser in a room the host", () => {
    const open = room();

    expect(inRoom()).toBe(true);
    expect(roomHostId()).toBe(open.room.clientId);
    expect(maySwitchPacks()).toBe(true);
  });

  it("disables the switches for a peer that is not the host, and says why", async () => {
    const open = room("a000aaaa0000");

    expect(roomHostId()).toBe("a000aaaa0000");
    expect(maySwitchPacks()).toBe(false);
    expect(switchBlockedReason()).toContain("Only the host can change tools in this room.");

    const packs = createPackController(open.store);
    await packs.setPack("monitors", false);

    expect(packStateOf(open.store.get(), "monitors")).toBeNull();
  });

  it("lets the host switch while a later peer is in the room", async () => {
    const open = room("z999zzzz9999");

    expect(roomHostId()).toBe(open.room.clientId);
    expect(maySwitchPacks()).toBe(true);

    const packs = createPackController(open.store);
    await packs.setPack("monitors", false);

    expect(packStateOf(open.store.get(), "monitors")?.enabled).toBe(false);
  });
});
