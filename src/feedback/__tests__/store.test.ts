import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "../../store/createStore";
import { LIMITS, type Feedback, type FeedbackTarget, type Workspace } from "../../types";
import { addFeedback, openFeedback, resolveFeedback, resolvedFeedback } from "../store";

const dashboard: FeedbackTarget = { kind: "dashboard", id: "Invoices" };
const overview: FeedbackTarget = { kind: "overview", id: "overview" };

const base = (): Workspace => emptyWorkspace("demo", "2026-08-28T09:00:00.000Z");

const only = (ws: Workspace): Feedback => {
  const items = Object.values(ws.feedback);
  expect(items).toHaveLength(1);
  return items[0] as Feedback;
};

/** Build a workspace holding `count` notes without going through addFeedback. */
function seeded(count: number, resolvedUpTo: number): Workspace {
  const items: Feedback[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
    items.push({
      id: `f${i}`,
      target: dashboard,
      text: `note ${i}`,
      author: "human",
      createdAt: at,
      ...(i < resolvedUpTo ? { resolvedAt: at, resolvedBy: "agent" as const } : {}),
    });
  }
  return { ...base(), feedback: Object.fromEntries(items.map((item) => [item.id, item])) };
}

describe("addFeedback", () => {
  it("stores the note and audits it without mutating the workspace", () => {
    const before = base();
    const after = addFeedback(before, { target: dashboard, text: "  y axis is wrong  ", author: "human" });

    expect(before.feedback).toEqual({});
    expect(only(after).text).toBe("y axis is wrong");
    expect(only(after).author).toBe("human");
    expect(after.audit).toHaveLength(1);
    expect(after.audit[0]).toMatchObject({ actor: "human", tool: "feedback", ok: true });
  });

  it("caps the text at LIMITS.maxFeedbackChars", () => {
    const after = addFeedback(base(), { target: dashboard, text: "x".repeat(900), author: "human" });
    expect(only(after).text).toHaveLength(LIMITS.maxFeedbackChars);
  });

  it("keeps the cap by dropping the oldest resolved note first", () => {
    const full = seeded(LIMITS.maxFeedbackItems, 3);
    const after = addFeedback(full, { target: overview, text: "one more", author: "human" });
    const ids = new Set(Object.keys(after.feedback));

    expect(ids.size).toBe(LIMITS.maxFeedbackItems);
    expect(ids.has("f0")).toBe(false);
    expect(ids.has("f1")).toBe(true);
    expect(openFeedback(after, overview)).toHaveLength(1);
  });

  it("drops the oldest open note only when no resolved note is left to drop", () => {
    const full = seeded(LIMITS.maxFeedbackItems, 0);
    const after = addFeedback(full, { target: overview, text: "one more", author: "human" });

    expect(Object.keys(after.feedback)).toHaveLength(LIMITS.maxFeedbackItems);
    expect(after.feedback.f0).toBeUndefined();
    expect(after.feedback.f1).toBeDefined();
  });
});

describe("resolveFeedback", () => {
  it("marks the note resolved by its author and audits it", () => {
    const withNote = addFeedback(base(), { target: dashboard, text: "fix the title", author: "human" });
    const id = only(withNote).id;
    const after = resolveFeedback(withNote, id, { by: "agent", resolution: "Renamed it" });

    expect(after).not.toBeNull();
    expect(openFeedback(after as Workspace, dashboard)).toHaveLength(0);
    expect(resolvedFeedback(after as Workspace, dashboard)[0]).toMatchObject({
      resolvedBy: "agent",
      resolution: "Renamed it",
    });
    expect((after as Workspace).audit).toHaveLength(2);
    expect(only(withNote).resolvedAt).toBeUndefined();
  });

  it("returns null for an unknown id", () => {
    expect(resolveFeedback(base(), "nope", { by: "agent", resolution: "done" })).toBeNull();
  });
});

describe("openFeedback", () => {
  it("returns open notes newest first and scopes them by target", () => {
    const first = addFeedback(base(), { target: dashboard, text: "one", author: "human" });
    const second = addFeedback(first, { target: overview, text: "two", author: "human" });

    expect(openFeedback(second)).toHaveLength(2);
    expect(openFeedback(second, dashboard).map((item) => item.text)).toEqual(["one"]);
    const stamps = openFeedback(second).map((item) => item.createdAt);
    expect([...stamps].sort().reverse()).toEqual(stamps);
  });
});
