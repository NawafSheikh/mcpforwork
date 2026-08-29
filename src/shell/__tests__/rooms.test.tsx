/**
 * What a link says about the room, and what the top bar says back.
 *
 * The rule this file guards: a room link WITHOUT a key is a public room, not a locked
 * one. It boots, it joins, it registers the same site tools, and the badge says "Public
 * room" with the sentence that goes with it. The locked state is only for a key that
 * does not open the room, and the page can only learn that from the relay.
 */
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../../App";
import { ENCRYPTED_BADGE, LOCKED_ROOM_ACTION } from "../../crypto";
import { configureRooms, createMemoryHub, joinRoom, leaveRoom, resetRoomSecret } from "../../rooms";
import { createWorkspaceStore } from "../../store";
import { ShellProvider } from "../context";
import { roomBoot } from "../lib/boot";
import {
  LOCAL_BOARD_LABEL,
  PUBLIC_ROOM_LABEL,
  PUBLIC_ROOM_NOTE,
  WRONG_KEY_MESSAGE,
} from "../lib/constants";
import { isWrongKey } from "../lib/room";
import { RoomBadge } from "../topbar/RoomBadge";
import { WrongKey } from "../center/WrongKey";

const KEY = "a".repeat(43);
const SLUG = "proofq7m2k4";

const statusStore = {
  get: () => ({ available: false, registered: 0 }),
  subscribe: () => () => undefined,
};

afterEach(() => {
  leaveRoom();
  resetRoomSecret();
  configureRooms(null);
});

describe("what a link boots into", () => {
  it("reads a keyless room link as public, not as broken", () => {
    expect(roomBoot(`https://mcpforwork.com/?room=${SLUG}`)).toEqual({
      kind: "public",
      slug: SLUG,
      role: "write",
    });
  });

  it("reads a link with a key as an encrypted room", () => {
    const boot = roomBoot(`https://mcpforwork.com/?room=${SLUG}#k=${KEY}`);
    expect(boot.kind).toBe("encrypted");
    expect(boot.secret).toBe(KEY);
  });

  it("reads a read-only link as a room this browser will not rename", () => {
    expect(roomBoot(`https://mcpforwork.com/?room=${SLUG}#k=${KEY}&r=read`).role).toBe("read");
  });

  it("reads a page with no room at all", () => {
    expect(roomBoot("https://mcpforwork.com/").kind).toBe("none");
  });
});

describe("the badge in the top bar", () => {
  it("says the board never left this browser", () => {
    expect(renderToStaticMarkup(<RoomBadge inRoom={false} fingerprint={null} />)).toContain(
      LOCAL_BOARD_LABEL,
    );
  });

  it("says Public room, in the words a stranger needs", () => {
    const html = renderToStaticMarkup(<RoomBadge inRoom fingerprint={null} />);
    expect(html).toContain(PUBLIC_ROOM_LABEL);
    expect(html).toContain(PUBLIC_ROOM_NOTE);
  });

  it("says the fingerprint of an encrypted room", () => {
    const html = renderToStaticMarkup(<RoomBadge inRoom fingerprint="ab12cd34" />);
    expect(html).toContain("#ab12cd34");
    expect(html).toContain(ENCRYPTED_BADGE);
  });
});

describe("a public room, joined", () => {
  it("renders the whole workspace with the public badge, and no locked card", () => {
    const store = createWorkspaceStore({ mode: "local", persist: false });
    const hub = createMemoryHub();
    configureRooms({ store, transport: hub.transport });
    joinRoom(SLUG);

    const html = renderToStaticMarkup(
      <ShellProvider store={store} statusStore={statusStore}>
        <App />
      </ShellProvider>,
    );

    expect(html).toContain(PUBLIC_ROOM_LABEL);
    expect(html).not.toContain("does not open this room");
    // The site tools pill is on the page either way: nothing about a public room
    // stops this browser registering them.
    expect(html).toContain("WebMCP not available");
    expect(html).toContain("Invite");
  });
});

describe("a key that does not open the room", () => {
  it("waits the whole window before saying anything", () => {
    const base = { unreadable: 3, boardEmpty: true, waitMs: 10_000 };
    expect(isWrongKey({ ...base, elapsedMs: 4_000 })).toBe(false);
    expect(isWrongKey({ ...base, elapsedMs: 10_000 })).toBe(true);
  });

  it("stays quiet when something readable did arrive", () => {
    expect(
      isWrongKey({ unreadable: 3, boardEmpty: false, elapsedMs: 30_000, waitMs: 10_000 }),
    ).toBe(false);
  });

  it("stays quiet when nothing unreadable ever arrived", () => {
    expect(
      isWrongKey({ unreadable: 0, boardEmpty: true, elapsedMs: 30_000, waitMs: 10_000 }),
    ).toBe(false);
  });

  it("says the one sentence and offers the one way out", () => {
    const html = renderToStaticMarkup(<WrongKey />);
    // React escapes the apostrophe, so the sentence is checked in the two halves
    // either side of it rather than by pretending the markup is plain text.
    const [before, after] = WRONG_KEY_MESSAGE.split("'");
    expect(before).toBeDefined();
    expect(html).toContain(before);
    expect(html).toContain(after);
    expect(html).toContain(LOCKED_ROOM_ACTION);
    expect(html).not.toContain("room=");
  });
});
