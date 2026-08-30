/**
 * The purpose, and the toolset an agent argued for on the strength of it.
 *
 * The rule under test is the one that matters in a room: an agent may switch on what only
 * touches this page, and may only ASK for anything that can act outside it. And whichever
 * way it goes, the reason it gave is kept, because a switch with no reason beside it tells
 * a person nothing.
 */
import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "../../store";
import { packEnabled } from "../../packs/state";
import type { Workspace } from "../../types";
import { coerceToolChoice } from "../coerce";
import { listChoices, needsAPerson, purposeHandlers } from "../tools";

const board = (): Workspace => emptyWorkspace("local");
const AT = "2026-08-30T12:00:00.000Z";

describe("saying what this is for", () => {
  it("records the purpose and points at the next call", () => {
    const out = purposeHandlers.set_purpose({ purpose: "close the August supplier invoices" }, board());

    expect(out.next?.purpose).toBe("close the August supplier invoices");
    expect(out.result).toContain("propose_tools");
  });

  it("refuses an empty purpose rather than storing a blank", () => {
    const out = purposeHandlers.set_purpose({ purpose: "   " }, board());
    expect(out.next).toBeUndefined();
  });
});

describe("choosing the toolset", () => {
  it("switches on what only touches this page, and keeps the reason", () => {
    const out = purposeHandlers.propose_tools(
      {
        on: [
          { pack: "board", why: "the invoices go on the board" },
          { pack: "datasets", why: "the statement arrives as a CSV" },
        ],
        from: "Nawaf's Codex",
      },
      board(),
    );

    const next = out.next as Workspace;
    expect(packEnabled(next, "board", false)).toBe(true);
    expect(listChoices(next).map((item) => item.pack)).toEqual(["board", "datasets"]);
    expect(listChoices(next)[0]?.why).toBe("the invoices go on the board");
    expect(listChoices(next)[0]?.by).toBe("Nawaf's Codex");
    expect(out.result).toContain("On: board, datasets");
  });

  it("will not switch on a pack that can act outside this page, and says who has to", () => {
    expect(needsAPerson("monitors")).toBe(true);
    expect(needsAPerson("board")).toBe(false);

    const out = purposeHandlers.propose_tools(
      { on: [{ pack: "monitors", why: "it should watch for overdue ones" }], from: "Nawaf's Codex" },
      board(),
    );
    const next = out.next as Workspace;

    expect(out.result).toContain("Waiting for a person");
    expect(out.result).toContain("it should watch for overdue ones");
    expect(listChoices(next)[0]?.proposed).toBe(true);
    expect(next.packs?.monitors).toBeUndefined();
  });

  it("switches packs off with a reason too", () => {
    const out = purposeHandlers.propose_tools(
      { off: [{ pack: "datasets", why: "nothing here is a file" }], from: "Ana's Claude" },
      board(),
    );
    const next = out.next as Workspace;

    expect(packEnabled(next, "datasets", false)).toBe(false);
    expect(listChoices(next)[0]?.on).toBe(false);
    expect(out.result).toContain("Off: datasets");
  });

  it("names a pack it does not have rather than failing the whole call", () => {
    const out = purposeHandlers.propose_tools(
      {
        on: [
          { pack: "board", why: "yes" },
          { pack: "telepathy", why: "no" },
        ],
      },
      board(),
    );

    expect(out.result).toContain("On: board");
    expect(out.result).toContain("No pack called telepathy");
  });

  it("lists what exists when it is asked for nothing", () => {
    const out = purposeHandlers.propose_tools({}, board());
    expect(out.next).toBeUndefined();
    expect(out.result).toContain("board");
    expect(out.result).toContain("monitors");
  });

  it("drops an entry with no reason, because the reason is the point", () => {
    const out = purposeHandlers.propose_tools({ on: [{ pack: "board", why: "  " }] }, board());
    expect(out.result).toContain("Nothing proposed");
  });
});

describe("a choice that arrived from a peer", () => {
  it("keeps a whole one", () => {
    const kept = coerceToolChoice(
      { pack: "board", on: true, why: "the work goes here", by: "Ana's Claude", at: AT },
      AT,
    );
    expect(kept?.pack).toBe("board");
    expect(kept?.on).toBe(true);
  });

  it("drops one naming a pack this build does not have", () => {
    expect(coerceToolChoice({ pack: "telepathy", on: true, why: "x", by: "y" }, AT)).toBeNull();
    expect(coerceToolChoice({ pack: "__proto__", on: true, why: "x", by: "y" }, AT)).toBeNull();
    expect(coerceToolChoice({ pack: "board", on: true }, AT)).toBeNull();
  });
});
