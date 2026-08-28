/**
 * Slugs, room URLs and the untrusted wire edge.
 * Nothing here touches a network: the Supabase frames are checked as strings.
 */
import { describe, expect, it } from "vitest";
import {
  ROOM_SLUG_PATTERN,
  isRoomSlug,
  leaveRoomUrl,
  mintRoomSlug,
  readRoomSlug,
  roomJoinUrl,
  roomStoreKey,
} from "../slug";
import { coerceAuditEvent, coerceMessage, coercePatch, encodeMessage } from "../wire";
import { broadcastFrame, heartbeatFrame, joinFrame, readFrame, realtimeSocketUrl, roomTopic } from "../supabase";
import { ROOM_LIMITS, type RoomMessage } from "../types";

const HOME = { origin: "https://mcpforwork.com", pathname: "/", search: "" };

describe("room slugs", () => {
  it("mints slugs that match the published pattern and avoid look-alike characters", () => {
    for (let i = 0; i < 200; i += 1) {
      const slug = mintRoomSlug();
      expect(slug).toHaveLength(10);
      expect(ROOM_SLUG_PATTERN.test(slug)).toBe(true);
      expect(slug).not.toMatch(/[lo01]/);
    }
  });

  it("mints different slugs", () => {
    const seen = new Set(Array.from({ length: 200 }, () => mintRoomSlug()));
    expect(seen.size).toBeGreaterThan(190);
  });

  it("rejects anything that is not a slug", () => {
    expect(isRoomSlug("abc123")).toBe(true);
    expect(isRoomSlug("ABC123")).toBe(false);
    expect(isRoomSlug("abc")).toBe(false);
    expect(isRoomSlug("abc-123")).toBe(false);
    expect(isRoomSlug("a".repeat(17))).toBe(false);
    expect(isRoomSlug(undefined)).toBe(false);
    expect(isRoomSlug("__proto__")).toBe(false);
  });

  it("reads the slug from the query and never from a fragment", () => {
    expect(readRoomSlug("?room=abc123")).toBe("abc123");
    expect(readRoomSlug("room=abc123&mode=live")).toBe("abc123");
    expect(readRoomSlug("?share=abc123")).toBeNull();
    expect(readRoomSlug("?room=NOT-A-SLUG")).toBeNull();
    expect(readRoomSlug("")).toBeNull();
  });

  it("builds a join link in the query, keeping other params and dropping the fragment", () => {
    const url = roomJoinUrl("abc123", { ...HOME, search: "?mode=live" });
    expect(url).toBe("https://mcpforwork.com/?mode=live&room=abc123");
    expect(url).not.toContain("#");
    expect(leaveRoomUrl({ ...HOME, search: "?mode=live&room=abc123" })).toBe(
      "https://mcpforwork.com/?mode=live",
    );
  });

  it("scopes persistence per room", () => {
    expect(roomStoreKey("abc123")).toBe("mfw:workspace:room:abc123");
  });
});

describe("the untrusted wire edge", () => {
  it("drops frames that are not messages at all", () => {
    expect(coerceMessage(null)).toBeNull();
    expect(coerceMessage("hello")).toBeNull();
    expect(coerceMessage({ t: "patch" })).toBeNull();
    expect(coerceMessage({ t: "nonsense", from: "c1" })).toBeNull();
    expect(coerceMessage({ t: "hello", from: "__proto__", peer: {} })).toBeNull();
  });

  it("keeps a well formed patch message and drops the malformed patches inside it", () => {
    const message = coerceMessage({
      t: "patch",
      from: "c1",
      at: "2026-08-28T10:00:00.000Z",
      patches: [
        { kind: "category", key: "Invoices", value: { name: "Invoices" }, at: "2026-08-28T10:00:00.000Z", origin: "c1" },
        { kind: "nope", key: "x", value: {}, at: "2026-08-28T10:00:00.000Z", origin: "c1" },
        { kind: "category", key: "__proto__", value: {}, at: "2026-08-28T10:00:00.000Z", origin: "c1" },
        "not an object",
      ],
    });
    expect(message?.t).toBe("patch");
    expect(message?.t === "patch" ? message.patches : []).toHaveLength(1);
  });

  it("caps how much audit one message can carry", () => {
    const patches = Array.from({ length: ROOM_LIMITS.auditPerMessage + 20 }, (_unused, index) => ({
      kind: "audit",
      key: `ev_${index}`,
      value: { id: `ev_${index}`, at: "2026-08-28T10:00:00.000Z", actor: "agent", ok: true },
      at: "2026-08-28T10:00:00.000Z",
      origin: "c1",
    }));
    const message = coerceMessage({ t: "patch", from: "c1", at: "2026-08-28T10:00:00.000Z", patches });
    expect(message?.t === "patch" ? message.patches.length : 0).toBe(ROOM_LIMITS.auditPerMessage);
  });

  it("rebuilds an audit event field by field and never trusts an actor it does not know", () => {
    const event = coerceAuditEvent(
      { id: "ev_1", at: "2026-08-28T10:00:00.000Z", actor: "root", tool: "upsert_dashboard", ok: false },
      "2026-08-28T11:00:00.000Z",
    );
    expect(event?.actor).toBe("agent");
    expect(event?.ok).toBe(false);
    expect(coerceAuditEvent({ at: "2026-08-28T10:00:00.000Z" }, "x")).toBeNull();
  });

  it("refuses to send a patch that is over the relay payload budget", () => {
    const big = { kind: "category" as const, key: "Big", value: "x".repeat(ROOM_LIMITS.maxMessageBytes), at: "2026-08-28T10:00:00.000Z", origin: "c1" };
    const message: RoomMessage = { t: "patch", from: "c1", at: "2026-08-28T10:00:00.000Z", patches: [big] };
    expect(encodeMessage(message)).toBeNull();
    expect(encodeMessage({ t: "bye", from: "c1", at: "2026-08-28T10:00:00.000Z" })).not.toBeNull();
  });

  it("keeps an unknown value shape raw until the apply step coerces it", () => {
    const patch = coercePatch(
      { kind: "draft", key: "d1", value: { anything: true }, at: "2026-08-28T10:00:00.000Z", origin: "c1" },
      "2026-08-28T10:00:00.000Z",
    );
    expect(patch?.kind).toBe("draft");
    expect(patch?.value).toEqual({ anything: true });
  });
});

describe("supabase realtime framing", () => {
  const config = { url: "https://demo.supabase.co", anonKey: "anon-key" };

  it("builds the documented websocket url", () => {
    expect(realtimeSocketUrl(config)).toBe(
      "wss://demo.supabase.co/realtime/v1/websocket?apikey=anon-key&vsn=1.0.0",
    );
  });

  it("joins a public channel, so the anon key is enough and no table is involved", () => {
    const frame = JSON.parse(joinFrame(roomTopic("abc123"), "1")) as Record<string, unknown>;
    expect(frame.topic).toBe("realtime:mfw-room-abc123");
    expect(frame.event).toBe("phx_join");
    expect(frame.payload).toEqual({
      config: { broadcast: { ack: false, self: false }, presence: { enabled: false }, private: false },
    });
  });

  it("heartbeats on the phoenix topic", () => {
    expect(JSON.parse(heartbeatFrame("7"))).toEqual({
      topic: "phoenix",
      event: "heartbeat",
      payload: {},
      ref: "7",
    });
  });

  it("round trips a message through a broadcast frame", () => {
    const topic = roomTopic("abc123");
    const message: RoomMessage = { t: "need", from: "c1", at: "2026-08-28T10:00:00.000Z" };
    const frame = broadcastFrame(topic, "2", message);
    expect(readFrame(frame, topic)).toEqual(message);
  });

  it("ignores frames for another topic, another event, or plain rubbish", () => {
    const topic = roomTopic("abc123");
    const frame = broadcastFrame(topic, "2", { t: "bye", from: "c1", at: "2026-08-28T10:00:00.000Z" });
    expect(readFrame(frame, roomTopic("other"))).toBeNull();
    expect(readFrame("{not json", topic)).toBeNull();
    expect(readFrame(JSON.stringify({ topic, event: "phx_reply", payload: {} }), topic)).toBeNull();
  });
});
