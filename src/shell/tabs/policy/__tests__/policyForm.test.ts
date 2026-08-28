/**
 * The guardrail form is only worth having if what it writes means what the engine
 * reads, so every clause the form can produce is put back through evaluateDraft here.
 */
import { describe, expect, it } from "vitest";
import { describePolicy, diffPolicy, evaluateDraft, thresholdClause } from "../../../../policy";
import type { Policy, Threshold } from "../../../../types";
import { parsePolicyJson, stringifyPolicy } from "../json";
import {
  CAPS,
  MAX_AUTO_ACTIONS,
  addChip,
  autoActionsSentence,
  emptyRow,
  formIssues,
  policyFromForm,
  readValue,
  removeChip,
  toForm,
  type PolicyForm,
} from "../model";

const saved: Policy = {
  maxAutoActionsPerRun: 3,
  thresholds: [{ field: "amount", op: "gt", value: 5000, label: "Big" }],
  allowlist: ["tag_record"],
  denylist: ["payment"],
  requireHumanFor: ["pay"],
  notes: "Signed off by finance",
};

const noAutos = { autoApprovedSoFar: 0 };

const draft = (over: Record<string, unknown> = {}) => ({
  kind: "flag_invoice",
  target: "INV-1001",
  summary: "Flag it",
  ...over,
});

describe("form to policy", () => {
  it("round trips a saved policy without changing a clause", () => {
    expect(policyFromForm(toForm(saved))).toEqual(saved);
  });

  it("writes threshold clauses the engine names the same way", () => {
    const policy = policyFromForm(toForm(saved));
    const first = (policy.thresholds ?? [])[0] as Threshold;
    expect(thresholdClause(first)).toBe("threshold:amount>5000");
    const decision = evaluateDraft(policy, draft({ amount: 9000 }), noAutos);
    expect(decision.status).toBe("held");
    expect(decision.clause).toBe("threshold:amount>5000");
  });

  it("writes every operator the select offers", () => {
    const ops = [
      { op: "gte", value: "100", amount: 100, clause: "threshold:amount>=100" },
      { op: "lt", value: "100", amount: 99, clause: "threshold:amount<100" },
      { op: "lte", value: "100", amount: 100, clause: "threshold:amount<=100" },
      { op: "eq", value: "42", amount: 42, clause: "threshold:amount=42" },
    ] as const;
    for (const entry of ops) {
      const form: PolicyForm = {
        ...toForm({ maxAutoActionsPerRun: 5 }),
        thresholds: [{ ...emptyRow(), field: "amount", op: entry.op, value: entry.value }],
      };
      const decision = evaluateDraft(
        policyFromForm(form),
        draft({ amount: entry.amount }),
        noAutos,
      );
      expect(decision.clause).toBe(entry.clause);
    }
  });

  it("writes chips the engine holds on, by clause name", () => {
    const policy = policyFromForm(toForm(saved));
    expect(evaluateDraft(policy, draft({ kind: "pay", target: "Acme" }), noAutos).clause).toBe(
      "requireHumanFor:pay",
    );
    expect(
      evaluateDraft(policy, draft({ kind: "send_payment", target: "Acme" }), noAutos).clause,
    ).toBe("denylist:payment");
    expect(evaluateDraft(policy, draft({ kind: "tag_record" }), noAutos).status).toBe("auto");
  });

  it("reads a value with spaces or thousands commas, and nothing else", () => {
    expect(readValue(" 1,250 ")).toBe(1250);
    expect(readValue("-3.5")).toBe(-3.5);
    expect(readValue("")).toBeUndefined();
    expect(readValue("about five")).toBeUndefined();
  });

  it("drops blank, repeat and over long chips instead of writing them", () => {
    const list = addChip(addChip(addChip([], "pay", 5), "PAY", 5), "  ", 5);
    expect(list).toEqual(["pay"]);
    expect(addChip(["a", "b"], "c", 2)).toEqual(["a", "b"]);
    expect(removeChip(["pay", "wire"], "pay")).toEqual(["wire"]);
    const long = addChip([], "x".repeat(200), 5)[0] ?? "";
    expect(long.length).toBe(CAPS.entryChars);
  });

  it("leaves empty clauses out of the policy entirely", () => {
    const bare = policyFromForm(toForm({ maxAutoActionsPerRun: 0 }));
    expect(bare).toEqual({ maxAutoActionsPerRun: 0 });
    expect(describePolicy(bare)).toContain("Auto-approves nothing");
  });

  it("clamps the stepper to the range the schema allows", () => {
    const over: PolicyForm = { ...toForm(saved), maxAutoActionsPerRun: 999 };
    expect(policyFromForm(over).maxAutoActionsPerRun).toBe(MAX_AUTO_ACTIONS);
    expect(policyFromForm({ ...over, maxAutoActionsPerRun: -4 }).maxAutoActionsPerRun).toBe(0);
  });

  it("says in plain words what the stepper means", () => {
    expect(autoActionsSentence(0)).toContain("every action waits for a person");
    expect(autoActionsSentence(1)).toBe(
      "After 1 automatic action in one run, everything else waits for a person.",
    );
    expect(autoActionsSentence(4)).toContain("After 4 automatic actions");
  });

  it("diffs the edited policy against the saved one", () => {
    const form = toForm(saved);
    const edited = policyFromForm({
      ...form,
      maxAutoActionsPerRun: 1,
      denylist: ["payment", "wire"],
    });
    expect(diffPolicy(saved, edited)).toEqual([
      "maxAutoActionsPerRun: 3 -> 1",
      "denylist added: wire",
    ]);
  });
});

describe("an invalid form cannot save", () => {
  it("names a rule with no field", () => {
    const form: PolicyForm = {
      ...toForm(saved),
      thresholds: [{ ...emptyRow(), field: "  ", value: "10" }],
    };
    expect(formIssues(form)).toEqual(["Rule 1 needs a field name, for example amount."]);
  });

  it("names a rule with no number, and still previews the rest", () => {
    const form: PolicyForm = {
      ...toForm(saved),
      thresholds: [{ ...emptyRow(), field: "amount", value: "" }],
    };
    expect(formIssues(form)).toEqual(["Rule 1 needs a number to compare against."]);
    expect(policyFromForm(form).thresholds).toBeUndefined();
    expect(policyFromForm(form).denylist).toEqual(["payment"]);
  });

  it("rejects a stepper value outside the range", () => {
    expect(formIssues({ ...toForm(saved), maxAutoActionsPerRun: 51 })).toEqual([
      "Max auto actions must be a whole number from 0 to 50.",
    ]);
    expect(formIssues({ ...toForm(saved), maxAutoActionsPerRun: 2.5 })).toHaveLength(1);
  });

  it("is happy with the policy it opened", () => {
    expect(formIssues(toForm(saved))).toEqual([]);
  });
});

describe("the JSON toggle", () => {
  it("shows the form policy and reads it back unchanged", () => {
    const text = stringifyPolicy(policyFromForm(toForm(saved)));
    const parsed = parsePolicyJson(text);
    expect(parsed.errors).toEqual([]);
    expect(parsed.policy).toEqual(saved);
    expect(policyFromForm(toForm(parsed.policy as Policy))).toEqual(saved);
  });

  it("feeds an edit in the textarea straight back into the form", () => {
    const parsed = parsePolicyJson(JSON.stringify({ maxAutoActionsPerRun: 1, denylist: ["wire"] }));
    expect(parsed.policy).not.toBeNull();
    const form = toForm(parsed.policy as Policy);
    expect(form.maxAutoActionsPerRun).toBe(1);
    expect(form.denylist).toEqual(["wire"]);
    expect(policyFromForm(form)).toEqual({ maxAutoActionsPerRun: 1, denylist: ["wire"] });
  });

  it("reports broken JSON instead of throwing", () => {
    const parsed = parsePolicyJson("{ nope");
    expect(parsed.policy).toBeNull();
    expect(parsed.errors).toEqual(["That is not valid JSON yet."]);
  });

  it("reports schema problems field by field, never as an exception", () => {
    const parsed = parsePolicyJson(
      JSON.stringify({ maxAutoActionsPerRun: 99, denylist: "payment" }),
    );
    expect(parsed.policy).toBeNull();
    expect(parsed.errors.join(" ")).toContain("maxAutoActionsPerRun");
    expect(parsed.errors.join(" ")).toContain("denylist");
  });

  it("refuses a policy with no cap at all", () => {
    expect(parsePolicyJson(JSON.stringify({ notes: "hi" })).policy).toBeNull();
  });
});
