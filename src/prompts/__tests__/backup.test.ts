/**
 * A backup file is the copy of the board a person can actually keep. It carries the
 * work and the notes, it leaves the audit trail on the machine that wrote it, and a
 * file that is not one of ours comes back as null rather than as a broken board.
 */
import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "../../store";
import { toSnapshot } from "../../share";
import type { Category, Feedback, Workspace } from "../../types";
import { backupFileName, backupJson, categoryCount, restoreFrom } from "../ui/backupFile";

const at = "2026-08-28T09:15:00.000Z";

const category: Category = {
  name: "Invoices",
  description: "What is owed",
  createdAt: at,
  dashboard: {
    category: "Invoices",
    kpis: [{ label: "Open", value: 12 }],
    charts: [],
    updatedAt: at,
  },
};

const note: Feedback = {
  id: "fb_1",
  target: { kind: "dashboard", id: "Invoices" },
  text: "The y axis is wrong",
  author: "human",
  createdAt: at,
};

function board(): Workspace {
  return {
    ...emptyWorkspace("local", at),
    name: "My board",
    categories: { Invoices: category },
    feedback: { fb_1: note },
    audit: [{ id: "ev_1", at, actor: "human", tool: "set_policy", ok: true }],
  };
}

describe("the file name", () => {
  it("is dated and timed in local time, to the minute", () => {
    expect(backupFileName(new Date(2026, 7, 28, 9, 5))).toBe(
      "mcpforwork-board-20260828-0905.json",
    );
    expect(backupFileName(new Date(2026, 11, 1, 23, 59))).toBe(
      "mcpforwork-board-20261201-2359.json",
    );
  });
});

describe("what the file holds", () => {
  it("is the share snapshot, so the work and the notes travel", () => {
    const parsed = JSON.parse(backupJson(board()));
    expect(parsed).toEqual(JSON.parse(JSON.stringify(toSnapshot(board()))));
    expect(parsed.categories.Invoices.dashboard.kpis[0].label).toBe("Open");
    expect(parsed.feedback.fb_1.text).toBe("The y axis is wrong");
  });

  it("leaves the audit trail behind", () => {
    expect(backupJson(board())).not.toContain("set_policy");
    expect(JSON.parse(backupJson(board())).audit).toBeUndefined();
  });
});

describe("reading one back", () => {
  it("rebuilds the board and keeps this machine's own identity", () => {
    const current: Workspace = { ...emptyWorkspace("live", at), id: "ws_local" };
    const restored = restoreFrom(backupJson(board()), current);
    expect(restored).not.toBeNull();
    expect(restored?.id).toBe("ws_local");
    expect(restored?.mode).toBe("live");
    expect(restored?.name).toBe("My board");
    expect(categoryCount(restored as Workspace)).toBe(1);
    expect(restored?.feedback.fb_1?.text).toBe("The y axis is wrong");
    expect(restored?.audit).toEqual([]);
  });

  it("refuses anything that is not a board, without throwing", () => {
    const current = emptyWorkspace("local", at);
    expect(restoreFrom("not json at all", current)).toBeNull();
    expect(restoreFrom("[1,2,3]", current)).toBeNull();
    expect(restoreFrom("null", current)).toBeNull();
  });

  it("drops entries it cannot read rather than trusting the file", () => {
    const hostile = JSON.stringify({
      id: "x",
      name: "Hostile",
      categories: { Ok: { name: "Ok", createdAt: at }, Bad: 42 },
      monitors: { m: "nope" },
      runs: "not an array",
      drafts: {},
      feedback: {},
      updatedAt: at,
    });
    const restored = restoreFrom(hostile, emptyWorkspace("local", at));
    expect(restored).not.toBeNull();
    expect(Object.keys(restored?.categories ?? {})).toEqual(["Ok"]);
    expect(restored?.monitors).toEqual({});
    expect(restored?.runs).toEqual([]);
  });

  it("counts the categories on the board it is about to replace", () => {
    expect(categoryCount(emptyWorkspace("local", at))).toBe(0);
    expect(categoryCount(board())).toBe(1);
  });
});
