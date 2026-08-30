/**
 * What the picture says. Pure, so the sentences in the centrepiece of the product are
 * tested rather than eyeballed: whose machine a loop is on, what it last said when it has
 * said nothing, and the words a person is handed to change it.
 */
import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "../../store";
import type { Loop, Workspace } from "../../types";
import { putLoop } from "../state";
import { loopRows, pictureLine, saidLine, talkPrompt, whereLine } from "../view";

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

describe("the picture", () => {
  it("marks the loops that run somewhere other than this browser", () => {
    const ws = board(loop("mine", 0), loop("theirs", 0, { host: "Ana's Claude" }));
    const rows = loopRows(ws, "Nawaf's Codex")[0]?.rows ?? [];

    expect(rows.find((row) => row.loop.id === "mine")?.remote).toBe(false);
    expect(rows.find((row) => row.loop.id === "theirs")?.remote).toBe(true);
  });

  it("claims nothing about whose machine it is when no agent has named itself", () => {
    const ws = board(loop("scan", 0, { host: "Ana's Claude" }));
    expect(loopRows(ws, null)[0]?.rows[0]?.remote).toBe(false);
  });

  it("names what feeds what, in both directions", () => {
    const ws = board(loop("scan", 0, { feeds: "rank" }), loop("rank", 1));
    const rows = loopRows(ws, null);

    expect(rows[0]?.rows[0]?.feedsName).toBe("rank");
    expect(rows[1]?.rows[0]?.fedBy).toEqual(["scan"]);
  });

  it("says a loop reported nothing rather than inventing a line", () => {
    expect(saidLine(loop("scan", 0))).toBe("has not reported yet");
    expect(saidLine(loop("scan", 0, { lastRunAt: AT }))).toBe("reported nothing");
    expect(saidLine(loop("scan", 0, { lastSaid: "4 under budget" }))).toBe("4 under budget");
  });

  it("puts the machine and the cadence in one line", () => {
    expect(whereLine(loop("scan", 0))).toBe("on Nawaf's Codex");
    expect(whereLine(loop("scan", 0, { every: "every 10 minutes" }))).toBe(
      "on Nawaf's Codex, every 10 minutes",
    );
  });

  it("counts loops and machines, and says when something wants a person", () => {
    expect(pictureLine(emptyWorkspace("local"))).toBe("Nothing is running yet.");

    const ws = board(
      loop("a", 0, { state: "running" }),
      loop("b", 0, { host: "Ana's Claude", state: "failed" }),
    );
    expect(pictureLine(ws)).toBe("2 loops, 2 machines, 1 running now, 1 wanting a person.");
  });
});

describe("the words a person is handed", () => {
  it("tells your own agent to change the loop directly", () => {
    const ws = board(loop("scan", 0));
    const row = loopRows(ws, "Nawaf's Codex")[0]?.rows[0];

    const text = talkPrompt(row as NonNullable<typeof row>);
    expect(text).toContain("change the loop");
    expect(text).toContain("rearrange_loop");
    expect(text).not.toContain("add_feedback");
  });

  it("routes it to the other agent when the loop is on their machine", () => {
    const ws = board(loop("scan", 0, { host: "Ana's Claude" }));
    const row = loopRows(ws, "Nawaf's Codex")[0]?.rows[0];

    const text = talkPrompt(row as NonNullable<typeof row>);
    expect(text).toContain("add_feedback");
    expect(text).toContain("Ana's Claude");
    expect(text).toContain("list_feedback");
  });
});
