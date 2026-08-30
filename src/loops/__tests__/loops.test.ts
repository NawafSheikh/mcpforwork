/**
 * Loops: the two invariants that make the picture true, and the four tools.
 *
 * The invariants are the whole point. "Everything below feeds the top" is only readable if
 * a loop can never feed sideways, downward, or into a ring, so those are refused with the
 * reason rather than quietly allowed and drawn wrong.
 */
import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "../../store";
import type { Loop, Workspace } from "../../types";
import { coerceLoop } from "../coerce";
import {
  clampLayer,
  dropLoop,
  feedRefusal,
  feeders,
  findLoop,
  hosts,
  layers,
  listLoops,
  loopId,
  putLoop,
} from "../state";
import { loopHandlers } from "../tools";

const AT = "2026-08-30T10:00:00.000Z";

const loop = (id: string, layer: number, extra: Partial<Loop> = {}): Loop => ({
  id,
  name: id,
  does: `what ${id} does`,
  layer,
  host: "Nawaf's Codex",
  state: "idle",
  records: [],
  createdAt: AT,
  updatedAt: AT,
  ...extra,
});

const board = (...loops: Loop[]): Workspace =>
  loops.reduce<Workspace>((ws, item) => putLoop(ws, item), emptyWorkspace("local"));

describe("the shape of the picture", () => {
  it("stacks loops into layers, floor first", () => {
    const ws = board(loop("scan", 0), loop("rank", 1), loop("watch", 0));
    const rows = layers(ws);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.map((item) => item.id)).toEqual(["scan", "watch"]);
    expect(rows[1]?.map((item) => item.id)).toEqual(["rank"]);
  });

  it("refuses a loop that would feed sideways or downward, and says why", () => {
    const ws = board(loop("scan", 1), loop("also", 1), loop("floor", 0));

    expect(feedRefusal(ws, loop("scan", 1), "also")).toContain("feeds upward only");
    expect(feedRefusal(ws, loop("scan", 1), "floor")).toContain("feeds upward only");
    expect(feedRefusal(ws, loop("scan", 1), "scan")).toContain("cannot feed itself");
    expect(feedRefusal(ws, loop("scan", 1), "ghost")).toContain("No loop with id");
  });

  it("allows a loop to feed one above it", () => {
    const ws = board(loop("scan", 0), loop("rank", 1));
    expect(feedRefusal(ws, loop("scan", 0), "rank")).toBeNull();
  });

  it("catches a ring even when the layers were edited into one", () => {
    // rank feeds scan, and scan is asked to feed rank: a two-loop ring.
    const ws = board(loop("scan", 5), loop("rank", 9, { feeds: "scan" }));
    expect(feedRefusal(ws, loop("scan", 5), "rank")).toContain("ring");
  });

  it("names who feeds whom, and every machine in the picture", () => {
    const ws = board(
      loop("scan", 0, { feeds: "rank", host: "Nawaf's Codex" }),
      loop("watch", 0, { feeds: "rank", host: "Ana's Claude" }),
      loop("rank", 1, { host: "Ana's Claude" }),
    );

    expect(feeders(ws, "rank").map((item) => item.id)).toEqual(["scan", "watch"]);
    expect(hosts(ws)).toEqual(["Nawaf's Codex", "Ana's Claude"]);
  });

  it("leaves a loop feeding nobody rather than pointing at a hole", () => {
    const ws = dropLoop(board(loop("scan", 0, { feeds: "rank" }), loop("rank", 1)), "rank");

    expect(listLoops(ws)).toHaveLength(1);
    expect(listLoops(ws)[0]?.feeds).toBeUndefined();
  });

  it("keeps layers inside the drawable range and ids safe to use as keys", () => {
    expect(clampLayer(-4)).toBe(0);
    expect(clampLayer(99)).toBe(5);
    expect(clampLayer(Number.NaN)).toBe(0);
    expect(loopId("Price scan!!", () => 0)).toBe("price-scan-0");
    expect(loopId("   ", () => 0)).toBe("loop-0");
  });
});

describe("the loop tools", () => {
  it("registers a loop on the caller's machine and says where it sits", () => {
    const out = loopHandlers.register_loop(
      { name: "price scan", does: "read the offers", every: "every 10 minutes", from: "Nawaf's Codex" },
      emptyWorkspace("local"),
    );

    const made = listLoops(out.next as Workspace)[0];
    expect(made?.name).toBe("price scan");
    expect(made?.host).toBe("Nawaf's Codex");
    expect(made?.layer).toBe(0);
    expect(out.result).toContain("layer 0");
    expect(out.result).toContain("running on Nawaf's Codex");
  });

  it("attaches a loop to the one it feeds, by name", () => {
    const ws = board(loop("rank", 1));
    const out = loopHandlers.register_loop(
      { name: "scan", does: "read", layer: 0, feeds: "rank", from: "Ana's Claude" },
      ws,
    );

    expect(findLoop(out.next as Workspace, "scan")?.feeds).toBe("rank");
    expect(out.result).toContain('It feeds "rank"');
  });

  it("registers the loop anyway when the arrangement is wrong, and says what is wrong", () => {
    const ws = board(loop("floor", 0));
    const out = loopHandlers.register_loop({ name: "scan", does: "read", layer: 1, feeds: "floor" }, ws);

    expect(findLoop(out.next as Workspace, "scan")?.feeds).toBeUndefined();
    expect(out.result).toContain("feeds upward only");
  });

  it("takes a tick and puts what it said into the picture", () => {
    const ws = board(loop("scan", 0));
    const out = loopHandlers.report_loop(
      { loop: "scan", state: "running", said: "4 offers under budget", from: "Nawaf's Codex" },
      ws,
    );

    const after = findLoop(out.next as Workspace, "scan");
    expect(after?.state).toBe("running");
    expect(after?.lastSaid).toBe("4 offers under budget");
    expect(after?.records).toHaveLength(1);
    expect(out.result).toContain("4 offers under budget");
  });

  it("tells an agent what to do instead of failing on an unknown loop", () => {
    const out = loopHandlers.report_loop({ loop: "ghost" }, emptyWorkspace("local"));
    expect(out.next).toBeUndefined();
    expect(out.result).toContain("register_loop");
  });

  it("reads back the whole picture by layer, with the machines", () => {
    const ws = board(
      loop("scan", 0, { feeds: "rank", host: "Nawaf's Codex" }),
      loop("rank", 1, { host: "Ana's Claude", lastSaid: "top 3 picked" }),
    );
    const parsed = JSON.parse(loopHandlers.list_loops({}, ws).result) as {
      layers: { layer: number; loops: { name: string; fedBy: string[]; lastSaid: string | null }[] }[];
      machines: string[];
    };

    expect(parsed.machines).toEqual(["Nawaf's Codex", "Ana's Claude"]);
    expect(parsed.layers[1]?.loops[0]?.fedBy).toEqual(["scan"]);
    expect(parsed.layers[1]?.loops[0]?.lastSaid).toBe("top 3 picked");
  });

  it("says there is nothing yet rather than answering with an empty shape", () => {
    expect(loopHandlers.list_loops({}, emptyWorkspace("local")).result).toContain("No loops");
  });

  it("moves a loop, and refuses a move that would break the picture", () => {
    const ws = board(loop("scan", 0), loop("rank", 1));

    const ok = loopHandlers.rearrange_loop({ loop: "scan", feeds: "rank", why: "rank reads it" }, ws);
    expect(findLoop(ok.next as Workspace, "scan")?.feeds).toBe("rank");
    expect(findLoop(ok.next as Workspace, "scan")?.records).toHaveLength(1);

    const bad = loopHandlers.rearrange_loop({ loop: "rank", feeds: "scan" }, ws);
    expect(bad.next).toBeUndefined();
    expect(bad.result).toContain("Not moved");
  });

  it("detaches a loop when it is asked to feed nothing", () => {
    const ws = board(loop("scan", 0, { feeds: "rank" }), loop("rank", 1));
    const out = loopHandlers.rearrange_loop({ loop: "scan", feeds: "" }, ws);

    expect(findLoop(out.next as Workspace, "scan")?.feeds).toBeUndefined();
    expect(out.result).toContain("feeding nothing");
  });
});

describe("a loop that arrived from somewhere we do not control", () => {
  it("keeps a whole one and drops one that is not a loop", () => {
    const kept = coerceLoop(
      { id: "scan", name: "scan", does: "read", layer: 2, host: "Ana", state: "running" },
      AT,
    );
    expect(kept?.layer).toBe(2);
    expect(kept?.state).toBe("running");

    expect(coerceLoop({ id: "scan" }, AT)).toBeNull();
    expect(coerceLoop(null, AT)).toBeNull();
  });

  it("repairs a layer out of range, an unknown state, and a loop feeding itself", () => {
    const fixed = coerceLoop(
      { id: "scan", name: "scan", does: "read", layer: 99, state: "exploded", feeds: "scan" },
      AT,
    );

    expect(fixed?.layer).toBe(5);
    expect(fixed?.state).toBe("idle");
    expect(fixed?.feeds).toBeUndefined();
    expect(fixed?.host).toBe("unknown");
  });

  it("refuses an id that would reach the prototype chain", () => {
    expect(coerceLoop({ id: "__proto__", name: "x", does: "y" }, AT)).toBeNull();
  });
});
