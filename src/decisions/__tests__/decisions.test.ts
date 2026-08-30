/**
 * Decisions: the rule that keeps the record honest, and the objection that cannot rewrite it.
 *
 * The rule is that what was chosen has to be something that was considered. An agent that
 * lists three options and does a fourth thing has made two moves and recorded one, and the
 * unrecorded one is exactly the move somebody would want to see.
 */
import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "../../store";
import { LIMITS, type Workspace } from "../../types";
import { coerceDecision } from "../coerce";
import { decisionHandlers, disagree, listDecisions } from "../tools";
import { objectionPrompt } from "../ui/Decisions";

const board = (): Workspace => emptyWorkspace("local");
const AT = "2026-08-30T14:00:00.000Z";

const made = (over: Record<string, unknown> = {}) => ({
  what: "which venue to scan first",
  considered: ["the cheap one", "the fast one", "both at once"],
  chose: "the fast one",
  because: "the cheap one is stale by the time it answers",
  from: "Nawaf's Codex",
  ...over,
});

describe("writing a decision down", () => {
  it("keeps the question, the options, the choice and the reason", () => {
    const out = decisionHandlers.decide(made(), board());
    const one = listDecisions(out.next as Workspace)[0];

    expect(one?.what).toBe("which venue to scan first");
    expect(one?.chose).toBe("the fast one");
    expect(one?.because).toContain("stale");
    expect(one?.considered).toHaveLength(3);
    expect(one?.by).toBe("Nawaf's Codex");
    expect(out.result).toContain("2 other options recorded");
  });

  it("refuses a choice that was never one of the options, and says why that matters", () => {
    const out = decisionHandlers.decide(made({ chose: "something else entirely" }), board());

    expect(out.next).toBeUndefined();
    expect(out.result).toContain("not one of the options");
    expect(out.result).toContain("two moves");
  });

  it("matches the choice to an option regardless of case and spacing", () => {
    const out = decisionHandlers.decide(made({ chose: "  THE FAST ONE " }), board());
    expect(out.next).toBeDefined();
  });

  it("refuses a decision with no options rather than recording a bare assertion", () => {
    const out = decisionHandlers.decide(made({ considered: [] }), board());
    expect(out.next).toBeUndefined();
    expect(out.result).toContain("options you considered");
  });

  it("needs all four parts", () => {
    expect(decisionHandlers.decide(made({ because: "  " }), board()).next).toBeUndefined();
    expect(decisionHandlers.decide(made({ what: "" }), board()).next).toBeUndefined();
  });

  it("says there are none rather than answering with an empty list", () => {
    expect(decisionHandlers.list_decisions({}, board()).result).toContain("No decisions");
  });

  it("reads them back with what was turned down", () => {
    const out = decisionHandlers.decide(made(), board());
    const parsed = JSON.parse(
      decisionHandlers.list_decisions({}, out.next as Workspace).result,
    ) as { decisions: { instead: string[]; chose: string }[]; total: number };

    expect(parsed.total).toBe(1);
    expect(parsed.decisions[0]?.chose).toBe("the fast one");
    expect(parsed.decisions[0]?.instead).toEqual(["the cheap one", "both at once"]);
  });

  it("drops the oldest once the board is full instead of growing forever", () => {
    let ws = board();
    for (let i = 0; i < LIMITS.maxDecisions + 5; i += 1) {
      const out = decisionHandlers.decide(
        made({ what: `question ${i}`, considered: [`option ${i}`], chose: `option ${i}` }),
        ws,
      );
      ws = (out.next ?? ws) as Workspace;
    }
    expect(Object.keys(ws.decisions ?? {}).length).toBeLessThanOrEqual(LIMITS.maxDecisions);
  });
});

describe("a person disagreeing", () => {
  it("records the objection beside the decision without changing it", () => {
    const out = decisionHandlers.decide(made(), board());
    const ws = out.next as Workspace;
    const id = listDecisions(ws)[0]?.id as string;

    const after = disagree(ws, id, "Nawaf", "the cheap one is fine on a Sunday");
    const one = listDecisions(after)[0];

    expect(one?.chose).toBe("the fast one");
    expect(one?.because).toContain("stale");
    expect(one?.disagreed?.by).toBe("Nawaf");
    expect(String(one?.disagreed?.said)).toContain("Sunday");
  });

  it("does nothing at all to a decision that is not there", () => {
    const ws = board();
    expect(disagree(ws, "missing", "Nawaf", "no")).toBe(ws);
  });

  it("hands over words that quote the reason being argued with", () => {
    const out = decisionHandlers.decide(made(), board());
    const one = listDecisions(out.next as Workspace)[0];
    const text = objectionPrompt(one as NonNullable<typeof one>, "it is fine on a Sunday");

    expect(text).toContain("the fast one");
    expect(text).toContain("stale");
    expect(text).toContain("list_decisions");
  });
});

describe("a decision that arrived from a peer", () => {
  it("keeps a whole one", () => {
    const kept = coerceDecision(
      {
        id: "d-1",
        what: "which venue",
        considered: ["a", "b"],
        chose: "a",
        because: "faster",
        by: "Ana's Claude",
        at: AT,
      },
      AT,
    );
    expect(kept?.chose).toBe("a");
  });

  it("drops one whose choice was never among its own options", () => {
    // That shape cannot be drawn honestly, and repairing it would mean inventing the
    // missing half.
    expect(
      coerceDecision(
        { id: "d-1", what: "x", considered: ["a"], chose: "z", because: "y", by: "n" },
        AT,
      ),
    ).toBeNull();
  });

  it("drops one with an id that would reach the prototype chain", () => {
    expect(
      coerceDecision(
        { id: "__proto__", what: "x", considered: ["a"], chose: "a", because: "y", by: "n" },
        AT,
      ),
    ).toBeNull();
  });
});
