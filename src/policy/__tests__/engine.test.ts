import { describe, expect, it } from "vitest";

import type { Policy } from "../../types";
import type { DraftCandidate } from "../engine";
import { describePolicy, diffPolicy, evaluateDraft } from "../engine";

const draft = (over: Partial<DraftCandidate> = {}): DraftCandidate => ({
  kind: "tag_record",
  target: "INV-1001",
  summary: "Tag the record for review",
  ...over,
});

const policy = (over: Partial<Policy> = {}): Policy => ({
  maxAutoActionsPerRun: 3,
  ...over,
});

const noAutos = { autoApprovedSoFar: 0 };

describe("evaluateDraft clauses", () => {
  it("holds on a threshold and names field, operator and value", () => {
    const decision = evaluateDraft(
      policy({ thresholds: [{ field: "amount", op: "gt", value: 5000 }] }),
      draft({ kind: "flag_invoice", amount: 9000 }),
      noAutos,
    );
    expect(decision.status).toBe("held");
    expect(decision.allowed).toBe(false);
    expect(decision.clause).toBe("threshold:amount>5000");
    expect(decision.reason).toContain("9000");
  });

  it("reads threshold fields out of the draft fields map, numbers or strings", () => {
    const stale = policy({
      thresholds: [{ field: "idleDays", op: "gte", value: 7 }],
    });
    expect(
      evaluateDraft(stale, draft({ fields: { idleDays: 9 } }), noAutos).status,
    ).toBe("held");
    expect(
      evaluateDraft(stale, draft({ fields: { idleDays: "12" } }), noAutos).status,
    ).toBe("held");
    expect(
      evaluateDraft(stale, draft({ fields: { idleDays: 2 } }), noAutos).status,
    ).toBe("pending");
  });

  it("ignores a threshold whose field is missing or not a number", () => {
    const thresholds = policy({
      thresholds: [{ field: "amount", op: "gt", value: 10 }],
    });
    expect(evaluateDraft(thresholds, draft(), noAutos).status).toBe("pending");
    expect(
      evaluateDraft(thresholds, draft({ fields: { amount: "n/a" } }), noAutos)
        .status,
    ).toBe("pending");
  });

  it("supports every operator", () => {
    const cases: readonly [Policy["thresholds"], number, string][] = [
      [[{ field: "amount", op: "gte", value: 100 }], 100, "threshold:amount>=100"],
      [[{ field: "amount", op: "lt", value: 100 }], 99, "threshold:amount<100"],
      [[{ field: "amount", op: "lte", value: 100 }], 100, "threshold:amount<=100"],
      [[{ field: "amount", op: "eq", value: 42 }], 42, "threshold:amount=42"],
    ];
    for (const [thresholds, amount, clause] of cases) {
      const decision = evaluateDraft(policy({ thresholds }), draft({ amount }), noAutos);
      expect(decision.clause).toBe(clause);
      expect(decision.status).toBe("held");
    }
  });

  it("holds on a denylist term matching the kind or the target, as a substring", () => {
    const denied = policy({ denylist: ["payment"] });
    const byKind = evaluateDraft(
      denied,
      draft({ kind: "send_payment", target: "Acme Test Ltd" }),
      noAutos,
    );
    expect(byKind.clause).toBe("denylist:payment");
    expect(byKind.status).toBe("held");
    expect(
      evaluateDraft(denied, draft({ target: "payment run 12" }), noAutos).status,
    ).toBe("held");
  });

  it("holds on requireHumanFor by exact kind", () => {
    const requires = policy({ requireHumanFor: ["merge_supplier"] });
    const decision = evaluateDraft(
      requires,
      draft({ kind: "merge_supplier" }),
      noAutos,
    );
    expect(decision.clause).toBe("requireHumanFor:merge_supplier");
    expect(
      evaluateDraft(requires, draft({ kind: "merge_supplier_notes" }), noAutos)
        .status,
    ).toBe("pending");
  });

  it("holds once the run has spent its auto budget", () => {
    const capped = policy({ maxAutoActionsPerRun: 2, allowlist: ["tag_record"] });
    expect(evaluateDraft(capped, draft(), { autoApprovedSoFar: 1 }).status).toBe("auto");
    const spent = evaluateDraft(capped, draft(), { autoApprovedSoFar: 2 });
    expect(spent.status).toBe("held");
    expect(spent.clause).toBe("maxAutoActionsPerRun:2");
  });

  it("holds everything when the policy auto-approves nothing", () => {
    const manual = evaluateDraft(policy({ maxAutoActionsPerRun: 0 }), draft(), noAutos);
    expect(manual.status).toBe("held");
    expect(manual.clause).toBe("maxAutoActionsPerRun:0");
  });

  it("applies clauses in the documented order", () => {
    const everything = policy({
      maxAutoActionsPerRun: 0,
      thresholds: [{ field: "amount", op: "gt", value: 10 }],
      denylist: ["payment"],
      requireHumanFor: ["send_payment"],
    });
    expect(
      evaluateDraft(everything, draft({ kind: "send_payment", amount: 99 }), noAutos)
        .clause,
    ).toBe("threshold:amount>10");
    expect(
      evaluateDraft(everything, draft({ kind: "send_payment" }), noAutos).clause,
    ).toBe("denylist:payment");
    expect(
      evaluateDraft(
        policy({ maxAutoActionsPerRun: 0, requireHumanFor: ["send_payment"] }),
        draft({ kind: "send_payment" }),
        noAutos,
      ).clause,
    ).toBe("requireHumanFor:send_payment");
  });
});

describe("allowlist behaviour", () => {
  it("auto-approves an exact kind or target match and names the allowlist clause", () => {
    const allowed = policy({ allowlist: ["tag_record", "INV-9"] });
    const byKind = evaluateDraft(allowed, draft(), noAutos);
    expect(byKind.status).toBe("auto");
    expect(byKind.allowed).toBe(true);
    expect(byKind.clause).toBe("allowlist");
    expect(
      evaluateDraft(allowed, draft({ kind: "other", target: "INV-9" }), noAutos)
        .status,
    ).toBe("auto");
  });

  it("is case-insensitive but never a substring match", () => {
    const allowed = policy({ allowlist: ["Tag_Record"] });
    expect(evaluateDraft(allowed, draft(), noAutos).status).toBe("auto");
    expect(
      evaluateDraft(allowed, draft({ kind: "tag_record_bulk" }), noAutos).status,
    ).toBe("pending");
  });

  it("leaves everything pending when no allowlist is set", () => {
    const decision = evaluateDraft(policy(), draft(), noAutos);
    expect(decision.status).toBe("pending");
    expect(decision.allowed).toBe(true);
    expect(decision.clause).toBeUndefined();
  });

  it("never auto-approves a draft a clause already held", () => {
    const conflict = policy({
      allowlist: ["send_payment"],
      denylist: ["payment"],
    });
    expect(
      evaluateDraft(conflict, draft({ kind: "send_payment" }), noAutos).status,
    ).toBe("held");
  });
});

describe("ordering of autos against the cap", () => {
  it("spends the budget in report order, then holds the rest", () => {
    const capped = policy({ maxAutoActionsPerRun: 2, allowlist: ["tag_record"] });
    const reported = [draft(), draft(), draft(), draft()];
    const statuses = reported.reduce<{ out: string[]; autos: number }>(
      (acc, candidate) => {
        const decision = evaluateDraft(capped, candidate, {
          autoApprovedSoFar: acc.autos,
        });
        return {
          out: [...acc.out, decision.status],
          autos: acc.autos + (decision.status === "auto" ? 1 : 0),
        };
      },
      { out: [], autos: 0 },
    );
    expect(statuses.out).toEqual(["auto", "auto", "held", "held"]);
    expect(statuses.autos).toBe(2);
  });

  it("does not count pending drafts against the budget", () => {
    const capped = policy({ maxAutoActionsPerRun: 1, allowlist: ["tag_record"] });
    const first = evaluateDraft(capped, draft({ kind: "notify_owner" }), noAutos);
    expect(first.status).toBe("pending");
    expect(evaluateDraft(capped, draft(), { autoApprovedSoFar: 0 }).status).toBe("auto");
  });
});

describe("diffPolicy", () => {
  it("returns no lines for an unchanged policy", () => {
    expect(diffPolicy(policy(), policy())).toEqual([]);
  });

  it("reports the cap, list and threshold changes in readable lines", () => {
    const before = policy({
      maxAutoActionsPerRun: 3,
      allowlist: ["tag_record"],
      thresholds: [{ field: "amount", op: "gt", value: 5000 }],
    });
    const after = policy({
      maxAutoActionsPerRun: 5,
      allowlist: ["tag_record", "notify_owner"],
      denylist: ["payment"],
      thresholds: [{ field: "amount", op: "gt", value: 2000 }],
      notes: "Tighter after the August review",
    });
    expect(diffPolicy(before, after)).toEqual([
      "maxAutoActionsPerRun: 3 -> 5",
      "threshold added: amount>2000",
      "threshold removed: amount>5000",
      "allowlist added: notify_owner",
      "denylist added: payment",
      "notes: Tighter after the August review",
    ]);
  });

  it("reports removals and cleared notes", () => {
    expect(
      diffPolicy(policy({ denylist: ["payment"], notes: "old" }), policy()),
    ).toEqual(["denylist removed: payment", "notes cleared"]);
  });
});

describe("describePolicy", () => {
  it("describes every clause in one paragraph", () => {
    const text = describePolicy(
      policy({
        maxAutoActionsPerRun: 2,
        allowlist: ["tag_record"],
        denylist: ["payment"],
        requireHumanFor: ["merge_supplier"],
        thresholds: [{ field: "amount", op: "gt", value: 5000 }],
      }),
    );
    expect(text).toContain("at most 2");
    expect(text).toContain("tag_record");
    expect(text).toContain("amount>5000");
    expect(text).toContain("payment");
    expect(text).toContain("merge_supplier");
    expect(text).not.toContain("\n");
  });

  it("says plainly when nothing runs itself", () => {
    expect(describePolicy(policy({ maxAutoActionsPerRun: 0 }))).toContain(
      "Auto-approves nothing",
    );
    expect(describePolicy(policy())).toContain("No allowlist is set");
  });
});
