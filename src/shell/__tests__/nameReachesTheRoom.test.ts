/**
 * The name a person types has to reach the other people in the room.
 *
 * Found on 30 Aug 2026 by running two real browsers against production: the second machine
 * listed the first person as "Unnamed" while the first machine rendered "Nawaf" everywhere.
 * The shell configures rooms once at bootstrap, before anybody has typed anything, so the
 * label captured there is the fallback; saveMyName then updated the live runtime, which on
 * a first visit does not exist yet, because the room is opened afterwards.
 *
 * The bug was invisible from the browser that had it. These tests are written from the
 * wire, which is the only place the difference shows: what the room was actually told.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configureRooms, createRoom, joinRoom } from "../../rooms";
import { createMemoryHub } from "../../rooms/transport";
import { createWorkspaceStore } from "../../store";
import { resetNameCache } from "../../feedback";
import { saveMyName } from "../lib/name";
import type { RoomMessage } from "../../rooms/types";

const BOOT_LABEL = "Unnamed";

function labelsAnnounced(sent: readonly RoomMessage[]): readonly string[] {
  return sent
    .filter((message): message is Extract<RoomMessage, { t: "hello" }> => message.t === "hello")
    .map((message) => message.peer.label);
}

function bootWithNoName(): ReturnType<typeof createMemoryHub> {
  const hub = createMemoryHub();
  configureRooms({
    store: createWorkspaceStore({ mode: "local", persist: false }),
    label: BOOT_LABEL,
    transport: hub.transport,
  });
  return hub;
}

describe("the name a person types reaches the room", () => {
  beforeEach(() => {
    resetNameCache();
    globalThis.localStorage?.clear();
  });

  afterEach(() => {
    configureRooms(null);
  });

  it("announces the typed name in a room opened after it was typed", () => {
    const hub = bootWithNoName();
    saveMyName("Nawaf");

    joinRoom("storyroom01");

    const announced = labelsAnnounced(hub.sent);
    expect(announced.length).toBeGreaterThan(0);
    expect(announced).toContain("Nawaf");
    // The point of the test: not once, anywhere, under the bootstrap fallback.
    expect(announced).not.toContain(BOOT_LABEL);
  });

  it("announces it through create_room too, which is the path an agent takes", async () => {
    const hub = bootWithNoName();
    saveMyName("Nawaf");

    await createRoom();

    expect(labelsAnnounced(hub.sent)).not.toContain(BOOT_LABEL);
  });

  it("still renames a room that is already open", () => {
    const hub = bootWithNoName();
    joinRoom("storyroom02");
    const before = labelsAnnounced(hub.sent).length;

    saveMyName("Ana");

    const after = labelsAnnounced(hub.sent);
    expect(after.length).toBeGreaterThan(before);
    expect(after.at(-1)).toBe("Ana");
  });

  it("keeps the typed name for the next room, not just the one that was open", () => {
    const hub = bootWithNoName();
    joinRoom("storyroom03");
    saveMyName("Nawaf");

    joinRoom("storyroom04");

    const fromSecondRoom = hub.sent.filter(
      (message): message is Extract<RoomMessage, { t: "hello" }> => message.t === "hello",
    );
    expect(fromSecondRoom.at(-1)?.peer.label).toBe("Nawaf");
  });

  it("refuses a blank name rather than announcing one", () => {
    const hub = bootWithNoName();
    saveMyName("Nawaf");
    joinRoom("storyroom05");

    expect(saveMyName("   ")).toBeNull();

    expect(labelsAnnounced(hub.sent).at(-1)).toBe("Nawaf");
  });
});
