/**
 * Claims: taken by writing, refreshed by writing, released by finishing, gone after ten
 * quiet minutes. Nothing in here blocks anybody, and the tests say so in as many words.
 */
import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "../../store/createStore";
import { LIMITS, type ClaimTarget, type Workspace } from "../../types";
import {
  claimAge,
  claimOn,
  claimsLine,
  describeClaimTarget,
  dropClaim,
  holdClaim,
  isHolder,
  liveClaims,
  pruneClaims,
  refreshClaim,
  workingOnText,
} from "../claims";
import { heldByMe, humanWrite, personRelease } from "../human";
import { settleTurn } from "../gate";
import { objectUpdatedAt } from "../versions";

const INVOICES: ClaimTarget = { kind: "dashboard", id: "Invoices" };
const OVERVIEW: ClaimTarget = { kind: "overview", id: "overview" };
const AT = new Date("2026-08-29T10:00:00.000Z");
const later = (minutes: number): Date => new Date(AT.getTime() + minutes * 60_000);

function board(): Workspace {
  return emptyWorkspace("demo", AT.toISOString());
}

describe("holding a turn", () => {
  it("puts a name on an object and takes it off again", () => {
    const held = holdClaim(board(), { target: INVOICES, holder: "Maria's agent", holderKind: "agent" }, AT);
    expect(claimOn(held, INVOICES, AT)?.holder).toBe("Maria's agent");
    expect(claimOn(dropClaim(held, INVOICES, AT), INVOICES, AT)).toBeNull();
  });

  it("expires after the quiet minutes and is ignored from that moment", () => {
    const held = holdClaim(board(), { target: INVOICES, holder: "Nawaf", holderKind: "person" }, AT);
    expect(claimOn(held, INVOICES, later(LIMITS.claimMinutes - 1))).not.toBeNull();
    expect(claimOn(held, INVOICES, later(LIMITS.claimMinutes + 1))).toBeNull();
    expect(liveClaims(held, later(LIMITS.claimMinutes + 1))).toHaveLength(0);
  });

  it("sweeps expired claims off the board on the next write", () => {
    const held = holdClaim(board(), { target: INVOICES, holder: "Ana", holderKind: "agent" }, AT);
    const swept = pruneClaims(held, later(LIMITS.claimMinutes + 1));
    expect(Object.keys(swept.claims)).toHaveLength(0);
  });

  it("keeps the same since stamp when the holder refreshes", () => {
    const held = holdClaim(board(), { target: INVOICES, holder: "Ana", holderKind: "agent" }, AT);
    const again = refreshClaim(held, INVOICES, "ana", later(2));
    expect(claimOn(again, INVOICES, later(2))?.since).toBe(AT.toISOString());
    expect(claimAge(claimOn(again, INVOICES, later(2)) ?? { since: AT.toISOString() } as never, later(4))).toBe("4 min");
  });

  it("leaves somebody else's claim alone when a stranger refreshes", () => {
    const held = holdClaim(board(), { target: INVOICES, holder: "Ana", holderKind: "agent" }, AT);
    const other = refreshClaim(held, INVOICES, "Ben", later(1));
    expect(claimOn(other, INVOICES, later(1))?.holder).toBe("Ana");
  });

  it("matches a holder whatever the case and spacing", () => {
    const claim = claimOn(
      holdClaim(board(), { target: INVOICES, holder: "Classify 1-25", holderKind: "agent" }, AT),
      INVOICES,
      AT,
    );
    expect(isHolder(claim ?? ({} as never), " classify 1-25 ")).toBe(true);
    expect(isHolder(claim ?? ({} as never), "somebody else")).toBe(false);
  });
});

describe("a person editing", () => {
  it("takes the badge from an agent without asking", () => {
    const agentHeld = holdClaim(board(), { target: INVOICES, holder: "ChatGPT", holderKind: "agent" }, AT);
    const edited = humanWrite(agentHeld, INVOICES, "Maria", later(1));
    const claim = claimOn(edited, INVOICES, later(1));
    expect(claim?.holder).toBe("Maria");
    expect(claim?.holderKind).toBe("person");
    expect(heldByMe(edited, INVOICES, "Maria", later(1))).toBe(true);
  });

  it("records the person as the last writer, so the agent is told who moved it", () => {
    const edited = humanWrite(board(), OVERVIEW, "Maria", AT);
    expect(edited.lastWriter["overview:overview"]?.by).toBe("Maria");
    expect(edited.lastWriter["overview:overview"]?.byKind).toBe("person");
    expect(objectUpdatedAt(edited, OVERVIEW)).toBe(AT.toISOString());
  });

  it("gives the badge back on release, and only its own", () => {
    const mine = humanWrite(board(), INVOICES, "Maria", AT);
    expect(claimOn(personRelease(mine, INVOICES, "Maria", AT), INVOICES, AT)).toBeNull();
    expect(claimOn(personRelease(mine, INVOICES, "Someone", AT), INVOICES, AT)?.holder).toBe("Maria");
  });
});

describe("what the writes do to a turn", () => {
  const outcome = (ws: Workspace) => ({ next: ws, result: "done" });

  it("claims automatically on a write that is not the finish", () => {
    const settled = settleTurn(
      "upsert_dataset_summary",
      { category: "Invoices" },
      outcome(board()),
      "Classify 1-25",
      AT,
    );
    expect(claimOn(settled.next ?? board(), INVOICES, AT)?.holder).toBe("Classify 1-25");
  });

  it("releases on the write that finishes the work", () => {
    const held = holdClaim(board(), { target: INVOICES, holder: "Ana", holderKind: "agent" }, AT);
    const settled = settleTurn("upsert_dashboard", { category: "Invoices" }, outcome(held), "Ana", later(1));
    expect(claimOn(settled.next ?? held, INVOICES, later(1))).toBeNull();
  });

  it("leaves a claim it does not hold in place when it finishes", () => {
    const held = holdClaim(board(), { target: INVOICES, holder: "Ana", holderKind: "agent" }, AT);
    const settled = settleTurn("upsert_dashboard", { category: "Invoices" }, outcome(held), "Ben", later(1));
    expect(claimOn(settled.next ?? held, INVOICES, later(1))?.holder).toBe("Ana");
  });

  it("says nothing about a tool that writes to no object", () => {
    const settled = settleTurn("create_room", {}, outcome(board()), "Ana", AT);
    expect(settled.next?.claims).toEqual({});
  });
});

describe("what people read", () => {
  it("names the target the way a person would say it", () => {
    expect(describeClaimTarget(INVOICES)).toBe("dashboard Invoices");
    expect(describeClaimTarget(OVERVIEW)).toBe("the overview");
  });

  it("lists who is on what for the presence chip", () => {
    const one = holdClaim(board(), { target: INVOICES, holder: "Maria's agent", holderKind: "agent" }, AT);
    const two = holdClaim(one, { target: OVERVIEW, holder: "Nawaf", holderKind: "person" }, later(1));
    expect(claimsLine(two, later(2))).toBe("Maria's agent on Invoices, Nawaf on the overview");
  });

  it("offers information, not a refusal, when somebody else is mid-edit", () => {
    const held = holdClaim(board(), { target: INVOICES, holder: "Maria's agent", holderKind: "agent" }, AT);
    const line = workingOnText(claimOn(held, INVOICES, later(4)) ?? ({} as never), later(4));
    expect(line).toBe("Maria's agent is working on dashboard Invoices (4 min).");
    expect(line).not.toContain("Refused");
  });
});
