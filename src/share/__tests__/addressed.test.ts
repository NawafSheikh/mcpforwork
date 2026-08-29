/**
 * A note addressed to somebody has to survive the trip.
 *
 * Before this, the share coercers knew four target kinds and dropped `from`, so a request
 * handed to another visitor's agent arrived in their browser as an unsigned note on a
 * dashboard: the handover worked locally and broke across the wire. Both paths are tested
 * here, because a room patch and a share link go through the same coercers.
 */
import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "../../store/createStore";
import { applyPatches, derivePatches } from "../../rooms";
import { fromSnapshot, toSnapshot } from "../snapshot";
import type { Claim, Feedback, Workspace } from "../../types";

const AT = "2026-08-29T10:00:00.000Z";

const NOTE: Feedback = {
  id: "fb_ask_maria",
  target: { kind: "agent", id: "Maria" },
  text: "Split the Invoices bar by ageing bucket before the standup.",
  author: "agent",
  from: "Classify 1-25",
  createdAt: AT,
};

const ROOM_NOTE: Feedback = {
  id: "fb_room",
  target: { kind: "room", id: "room" },
  text: "Anybody free to look at the overview?",
  author: "human",
  from: "Nawaf",
  createdAt: AT,
};

const PERSON_NOTE: Feedback = {
  id: "fb_person",
  target: { kind: "person", id: "Maria" },
  text: "The EUR 7,200 invoice needs you.",
  author: "agent",
  from: "ChatGPT",
  createdAt: AT,
};

const CLAIM: Claim = {
  target: { kind: "dashboard", id: "Invoices" },
  holder: "Maria's agent",
  holderKind: "agent",
  since: AT,
  expiresAt: "2026-08-29T10:10:00.000Z",
};

function board(): Workspace {
  return {
    ...emptyWorkspace("local", AT),
    feedback: { [NOTE.id]: NOTE, [ROOM_NOTE.id]: ROOM_NOTE, [PERSON_NOTE.id]: PERSON_NOTE },
    claims: { "dashboard:Invoices": CLAIM },
    lastWriter: { "dashboard:Invoices": { at: AT, by: "Maria's agent", byKind: "agent" } },
  };
}

describe("a note addressed to an agent, a person or the room", () => {
  it("survives a share snapshot with its target and its signature", () => {
    const restored = fromSnapshot(JSON.parse(JSON.stringify(toSnapshot(board()))));

    expect(restored?.feedback[NOTE.id]?.target).toEqual({ kind: "agent", id: "Maria" });
    expect(restored?.feedback[NOTE.id]?.from).toBe("Classify 1-25");
    expect(restored?.feedback[ROOM_NOTE.id]?.target.kind).toBe("room");
    expect(restored?.feedback[PERSON_NOTE.id]?.target.kind).toBe("person");
    expect(restored?.feedback[PERSON_NOTE.id]?.from).toBe("ChatGPT");
  });

  it("survives the room patches, which is where it used to arrive as a dashboard note", () => {
    const patches = derivePatches(emptyWorkspace("local", AT), board(), "aaa1", AT);
    const wire = JSON.parse(JSON.stringify(patches)) as typeof patches;
    const applied = applyPatches(emptyWorkspace("local", AT), wire, {});

    expect(applied.ws.feedback[NOTE.id]?.target).toEqual({ kind: "agent", id: "Maria" });
    expect(applied.ws.feedback[NOTE.id]?.from).toBe("Classify 1-25");
    expect(applied.ws.feedback[ROOM_NOTE.id]?.target).toEqual({ kind: "room", id: "room" });
    expect(applied.dropped).toBe(0);
  });
});

describe("a turn crossing the wire", () => {
  it("carries the claim and the last writer into a share snapshot", () => {
    const restored = fromSnapshot(JSON.parse(JSON.stringify(toSnapshot(board()))));

    expect(restored?.claims["dashboard:Invoices"]?.holder).toBe("Maria's agent");
    expect(restored?.claims["dashboard:Invoices"]?.expiresAt).toBe("2026-08-29T10:10:00.000Z");
    expect(restored?.lastWriter["dashboard:Invoices"]?.by).toBe("Maria's agent");
  });

  it("syncs to another browser as its own kind of patch", () => {
    const patches = derivePatches(emptyWorkspace("local", AT), board(), "aaa1", AT);
    expect(patches.filter((patch) => patch.kind === "claim")).toHaveLength(1);
    expect(patches.filter((patch) => patch.kind === "write")).toHaveLength(1);

    const wire = JSON.parse(JSON.stringify(patches)) as typeof patches;
    const applied = applyPatches(emptyWorkspace("local", AT), wire, {});
    expect(applied.ws.claims["dashboard:Invoices"]?.holderKind).toBe("agent");
    expect(applied.ws.lastWriter["dashboard:Invoices"]?.at).toBe(AT);
  });

  it("files a claim under the object it names, whatever key the sender used", () => {
    const patches = [
      { kind: "claim" as const, key: "dashboard:Somewhere else", value: CLAIM, at: AT, origin: "zzz9" },
    ];
    const applied = applyPatches(emptyWorkspace("local", AT), patches, {});

    expect(Object.keys(applied.ws.claims)).toEqual(["dashboard:Invoices"]);
  });
});
