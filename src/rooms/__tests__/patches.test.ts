/**
 * Deriving patches from immutable updates, and folding somebody else's patches back in.
 * These are the two halves that have to agree for two browsers to converge.
 */
import { describe, expect, it } from "vitest";
import { applyPatches, mergeAudit, noteLocal, type LwwClock } from "../apply";
import { derivePatches, fullPatches, tooManyPatches } from "../diff";
import { roomSnapshot, snapshotPatches } from "../snapshot";
import type { RoomPatch } from "../types";
import { LIMITS, type AuditEvent, type Category, type Workspace } from "../../types";

const T1 = "2026-08-28T10:00:00.000Z";
const T2 = "2026-08-28T10:00:05.000Z";
const T3 = "2026-08-28T10:00:09.000Z";

function board(): Workspace {
  return {
    id: "ws_demo",
    name: "Demo workspace",
    mode: "demo",
    categories: {},
    monitors: {},
    runs: [],
    drafts: {},
    feedback: {},
    audit: [],
    updatedAt: T1,
  };
}

function category(name: string, description: string): Category {
  return { name, description, createdAt: T1 };
}

function patch(kind: RoomPatch["kind"], key: string, value: unknown, at: string, origin: string): RoomPatch {
  return { kind, key, value, at, origin };
}

function event(id: string, at: string): AuditEvent {
  return { id, at, actor: "agent", tool: "upsert_dashboard", ok: true };
}

describe("deriving patches from an immutable update", () => {
  it("sees an added, a replaced and a removed category and nothing else", () => {
    const before: Workspace = { ...board(), categories: { A: category("A", "one"), B: category("B", "two") } };
    const after: Workspace = {
      ...before,
      categories: { A: before.categories.A as Category, C: category("C", "three") },
    };
    const patches = derivePatches(before, after, "c1", T2);
    expect(patches).toHaveLength(2);
    expect(patches.find((item) => item.key === "C")?.value).toEqual(category("C", "three"));
    expect(patches.find((item) => item.key === "B")?.value).toBeNull();
    expect(patches.every((item) => item.origin === "c1" && item.at === T2)).toBe(true);
  });

  it("says nothing when nothing changed, even for the same object", () => {
    const ws = board();
    expect(derivePatches(ws, ws, "c1", T2)).toHaveLength(0);
    expect(derivePatches(ws, { ...ws }, "c1", T2)).toHaveLength(0);
  });

  it("treats the overview as one entity and sends null when it is cleared", () => {
    const withOverview: Workspace = {
      ...board(),
      overview: { title: "Overview", kpis: [{ label: "Open", value: 3 }], charts: [], updatedAt: T1 },
    };
    const cleared: Workspace = { ...withOverview, overview: undefined };
    const patches = derivePatches(withOverview, cleared, "c1", T2);
    expect(patches).toEqual([{ kind: "overview", key: "overview", value: null, at: T2, origin: "c1" }]);
  });

  it("only ever grows the audit trail: a rolled-off event is not a deletion", () => {
    const kept = event("ev_2", T1);
    const before: Workspace = { ...board(), audit: [event("ev_1", T1), kept] };
    const after: Workspace = { ...before, audit: [kept, event("ev_3", T2)] };
    const patches = derivePatches(before, after, "c1", T2).filter((item) => item.kind === "audit");
    expect(patches).toHaveLength(1);
    expect(patches[0]?.key).toBe("ev_3");
    expect(patches.every((item) => item.value !== null)).toBe(true);
  });

  it("flags a change too big to ship as patches", () => {
    const many = Object.fromEntries(
      Array.from({ length: 100 }, (_unused, index) => [`C${index}`, category(`C${index}`, "x")]),
    );
    const patches = derivePatches(board(), { ...board(), categories: many }, "c1", T2);
    expect(tooManyPatches(patches)).toBe(true);
    expect(tooManyPatches(derivePatches(board(), board(), "c1", T2))).toBe(false);
  });
});

describe("last writer wins", () => {
  it("takes the newer write and ignores the older one whatever order they arrive in", () => {
    const early = patch("category", "A", category("A", "early"), T1, "c1");
    const late = patch("category", "A", category("A", "late"), T2, "c2");

    const forwards = applyPatches(board(), [early, late], {});
    expect(forwards.ws.categories.A?.description).toBe("late");
    expect(forwards.applied).toBe(2);

    const backwards = applyPatches(board(), [late, early], {});
    expect(backwards.ws.categories.A?.description).toBe("late");
    expect(backwards.stale).toBe(1);
  });

  it("breaks a dead heat on the origin id, so both browsers pick the same winner", () => {
    const a = patch("category", "A", category("A", "from-a"), T2, "aaa");
    const b = patch("category", "A", category("A", "from-b"), T2, "bbb");
    expect(applyPatches(board(), [a, b], {}).ws.categories.A?.description).toBe("from-b");
    expect(applyPatches(board(), [b, a], {}).ws.categories.A?.description).toBe("from-b");
  });

  it("refuses a remote write that predates a local edit of the same entity", () => {
    const local = patch("category", "A", category("A", "mine"), T3, "me");
    const clock: LwwClock = noteLocal({}, [local]);
    const stale = patch("category", "A", category("A", "theirs"), T2, "them");
    const outcome = applyPatches({ ...board(), categories: { A: category("A", "mine") } }, [stale], clock);
    expect(outcome.stale).toBe(1);
    expect(outcome.ws.categories.A?.description).toBe("mine");
  });

  it("lets one browser's later word replace its own, even inside the same millisecond", () => {
    const set = patch("category", "A", category("A", "one"), T2, "c1");
    const remove = patch("category", "A", null, T2, "c1");
    const outcome = applyPatches(board(), [set, remove], {});
    expect(outcome.stale).toBe(0);
    expect(outcome.ws.categories.A).toBeUndefined();
  });

  it("still refuses a same-millisecond write from a different browser that sorts lower", () => {
    const mine = patch("category", "A", category("A", "mine"), T2, "zzz");
    const theirs = patch("category", "A", category("A", "theirs"), T2, "aaa");
    const outcome = applyPatches(board(), [mine, theirs], {});
    expect(outcome.stale).toBe(1);
    expect(outcome.ws.categories.A?.description).toBe("mine");
  });

  it("applies a tombstone", () => {
    const start: Workspace = { ...board(), categories: { A: category("A", "one") } };
    const outcome = applyPatches(start, [patch("category", "A", null, T2, "c2")], {});
    expect(outcome.ws.categories.A).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(outcome.ws.categories, "A")).toBe(false);
  });

  it("carries a draft decision and a monitor across", () => {
    const draft = {
      id: "d1",
      monitorId: "m1",
      runId: "r1",
      kind: "pay",
      target: "ACME",
      summary: "Pay invoice 88",
      status: "approved",
      decidedBy: "human",
      decidedAt: T2,
    };
    const outcome = applyPatches(board(), [patch("draft", "d1", draft, T2, "c2")], {});
    expect(outcome.ws.drafts.d1?.status).toBe("approved");
    expect(outcome.ws.drafts.d1?.decidedBy).toBe("human");
  });
});

describe("malformed patches are dropped, never half applied", () => {
  it("drops a value that cannot be coerced and reports why", () => {
    const outcome = applyPatches(
      board(),
      [
        patch("category", "A", 42, T2, "c2"),
        patch("monitor", "m1", { name: "no id" }, T2, "c2"),
        patch("draft", "d1", { id: "d1" }, T2, "c2"),
        patch("overview", "overview", { kpis: [], charts: [] }, T2, "c2"),
        patch("category", "B", category("B", "good"), T2, "c2"),
      ],
      {},
    );
    expect(outcome.applied).toBe(1);
    expect(outcome.dropped).toBe(4);
    expect(outcome.reasons).toContain("category:A");
    expect(outcome.ws.categories.A).toBeUndefined();
    expect(outcome.ws.categories.B?.description).toBe("good");
  });

  it("clamps a hostile dashboard down to what the renderer can draw", () => {
    const charts = Array.from({ length: 20 }, (_unused, index) => ({
      kind: "bar",
      title: `chart ${index}`,
      points: Array.from({ length: 60 }, (_p, i) => ({ label: `p${i}`, value: i })),
    }));
    const outcome = applyPatches(
      board(),
      [patch("category", "A", { name: "A", dashboard: { category: "A", kpis: [{ label: "x", value: 1 }], charts } }, T2, "c2")],
      {},
    );
    const dashboard = outcome.ws.categories.A?.dashboard;
    expect(dashboard?.charts.length).toBeLessThanOrEqual(LIMITS.maxCharts);
    expect(dashboard?.charts[0]?.points.length).toBeLessThanOrEqual(LIMITS.maxPointsPerChart);
  });

  it("never lets a patch reach the prototype chain, even by renaming itself", () => {
    const outcome = applyPatches(
      board(),
      [
        patch("category", "A", { name: "__proto__" }, T2, "c2"),
        patch("monitor", "m1", { id: "constructor", name: "sneaky" }, T2, "c2"),
      ],
      {},
    );
    expect(outcome.dropped).toBe(2);
    expect(Object.keys(outcome.ws.categories)).toHaveLength(0);
    expect(Object.keys(outcome.ws.monitors)).toHaveLength(0);
    expect(({} as Record<string, unknown>).name).toBeUndefined();
  });
});

describe("the shared audit rail", () => {
  it("merges by id, keeps what is already there, and stays in time order", () => {
    const merged = mergeAudit([event("ev_2", T2)], [event("ev_1", T1), event("ev_2", T2), event("ev_3", T3)]);
    expect(merged.map((item) => item.id)).toEqual(["ev_1", "ev_2", "ev_3"]);
  });

  it("never overwrites an event a peer already holds", () => {
    const mine = { ...event("ev_1", T1), result: "mine" };
    const theirs = { ...event("ev_1", T1), result: "theirs" };
    expect(mergeAudit([mine], [theirs])[0]?.result).toBe("mine");
  });

  it("caps the rail so one busy room cannot grow it without limit", () => {
    const existing = Array.from({ length: LIMITS.maxAuditEvents }, (_unused, i) =>
      event(`old_${i}`, T1),
    );
    const merged = mergeAudit(existing, [event("new_1", T3)]);
    expect(merged).toHaveLength(LIMITS.maxAuditEvents);
    expect(merged[merged.length - 1]?.id).toBe("new_1");
  });

  it("an audit patch is additive: it is applied even when the clock has seen that key", () => {
    const first = applyPatches(board(), [patch("audit", "ev_1", event("ev_1", T1), T1, "c2")], {});
    const second = applyPatches(first.ws, [patch("audit", "ev_9", event("ev_9", T1), T1, "c2")], first.clock);
    expect(second.ws.audit.map((item) => item.id)).toEqual(["ev_1", "ev_9"]);
  });
});

describe("whole board messages", () => {
  it("sends the entities plus a capped audit tail", () => {
    const ws: Workspace = {
      ...board(),
      categories: { A: category("A", "one") },
      audit: Array.from({ length: 60 }, (_unused, i) => event(`ev_${i}`, T1)),
    };
    const snapshot = roomSnapshot(ws);
    expect(Object.keys(snapshot.categories)).toEqual(["A"]);
    expect(snapshot.audit.length).toBeLessThanOrEqual(24);
  });

  it("reads a snapshot back as patches stamped with the sender's board time", () => {
    const ws: Workspace = { ...board(), updatedAt: T2, categories: { A: category("A", "one") } };
    const patches = snapshotPatches(roomSnapshot(ws), "c2", T3);
    const one = patches.find((item) => item.kind === "category");
    expect(one?.at).toBe(T2);
    expect(one?.origin).toBe("c2");
  });

  it("loses to a local edit made after the sender's board last changed", () => {
    const sender: Workspace = { ...board(), updatedAt: T1, categories: { A: category("A", "theirs") } };
    const clock = noteLocal({}, [patch("category", "A", null, T3, "me")]);
    const outcome = applyPatches(
      { ...board(), categories: { A: category("A", "mine") } },
      snapshotPatches(roomSnapshot(sender), "c2", T3),
      clock,
    );
    expect(outcome.ws.categories.A?.description).toBe("mine");
  });

  it("survives a snapshot that is not a snapshot at all", () => {
    expect(snapshotPatches("nope", "c2", T2)).toHaveLength(0);
    expect(snapshotPatches(null, "c2", T2)).toHaveLength(0);
  });

  it("turns a board into a full patch set", () => {
    const ws: Workspace = { ...board(), categories: { A: category("A", "one"), B: category("B", "two") } };
    expect(fullPatches(ws, "c1", T2).filter((item) => item.kind === "category")).toHaveLength(2);
  });
});
