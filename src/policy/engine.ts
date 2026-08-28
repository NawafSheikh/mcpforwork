/**
 * Policy engine for draft actions. Implements docs/TOOLS.md "Policy semantics".
 *
 * A draft is held (and names the clause that held it) when, in this order:
 *   1. a threshold matches its amount or one of its numeric fields,
 *   2. its kind or target hits the denylist,
 *   3. its kind is in requireHumanFor,
 *   4. the run has already auto-approved maxAutoActionsPerRun drafts.
 * Otherwise it is auto when an allowlist is present and covers its kind or
 * target, and pending in every other case.
 *
 * `allowed` means "policy does not block this", so it is true for auto and
 * pending and false for held. approve_draft refuses exactly when it is false.
 */

import type { DraftAction, Policy, PolicyDecision, Threshold } from "../types";

export type DraftVerdict = "auto" | "pending" | "held";

/** A draft as the agent reports it, before the engine assigns identity or status. */
export type DraftCandidate = Omit<
  DraftAction,
  "status" | "id" | "runId" | "monitorId"
> & { amount?: number };

export type DraftEvaluation = PolicyDecision & { readonly status: DraftVerdict };

export interface RunContext {
  readonly autoApprovedSoFar: number;
}

const OP_SYMBOL = {
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  eq: "=",
} as const;

/** Stable clause name for a threshold, for example `threshold:amount>5000`. */
export function thresholdClause(threshold: Threshold): string {
  return `threshold:${threshold.field}${OP_SYMBOL[threshold.op]}${threshold.value}`;
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function toNumber(raw: unknown): number | undefined {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : undefined;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  const cleaned = raw.replace(/[\s,$£€]/g, "");
  if (cleaned === "") {
    return undefined;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Resolve the numeric value a threshold field points at, if the draft has one. */
export function fieldValue(
  draft: DraftCandidate,
  field: string,
): number | undefined {
  if (field === "amount" && draft.amount !== undefined) {
    return toNumber(draft.amount);
  }
  return toNumber(draft.fields?.[field]);
}

function breaches(value: number, threshold: Threshold): boolean {
  switch (threshold.op) {
    case "gt":
      return value > threshold.value;
    case "gte":
      return value >= threshold.value;
    case "lt":
      return value < threshold.value;
    case "lte":
      return value <= threshold.value;
    case "eq":
      return value === threshold.value;
    default:
      return false;
  }
}

function holdOnThreshold(
  policy: Policy,
  draft: DraftCandidate,
): DraftEvaluation | undefined {
  for (const threshold of policy.thresholds ?? []) {
    const value = fieldValue(draft, threshold.field);
    if (value === undefined || !breaches(value, threshold)) {
      continue;
    }
    const clause = thresholdClause(threshold);
    const label = threshold.label ? ` (${threshold.label})` : "";
    return {
      allowed: false,
      clause,
      reason: `${threshold.field} is ${value}, which trips ${clause}${label}.`,
      status: "held",
    };
  }
  return undefined;
}

/** Denylist matching is deliberately broad: substring, case-insensitive. */
function holdOnDenylist(
  policy: Policy,
  draft: DraftCandidate,
): DraftEvaluation | undefined {
  const haystack = `${normalize(draft.kind)} ${normalize(draft.target)}`;
  for (const raw of policy.denylist ?? []) {
    const term = normalize(raw);
    if (term === "" || !haystack.includes(term)) {
      continue;
    }
    return {
      allowed: false,
      clause: `denylist:${raw}`,
      reason: `Denylist term "${raw}" matches ${draft.kind} on ${draft.target}.`,
      status: "held",
    };
  }
  return undefined;
}

function holdOnRequireHuman(
  policy: Policy,
  draft: DraftCandidate,
): DraftEvaluation | undefined {
  const kind = normalize(draft.kind);
  const match = (policy.requireHumanFor ?? []).find(
    (entry) => normalize(entry) === kind,
  );
  if (match === undefined) {
    return undefined;
  }
  return {
    allowed: false,
    clause: `requireHumanFor:${draft.kind}`,
    reason: `Actions of kind "${draft.kind}" always need a human decision.`,
    status: "held",
  };
}

function holdOnRunCap(
  policy: Policy,
  context: RunContext,
): DraftEvaluation | undefined {
  const cap = policy.maxAutoActionsPerRun;
  if (context.autoApprovedSoFar < cap) {
    return undefined;
  }
  const spent = context.autoApprovedSoFar;
  return {
    allowed: false,
    clause: `maxAutoActionsPerRun:${cap}`,
    reason:
      cap === 0
        ? "This policy auto-approves nothing, so every action needs a human."
        : `This run already auto-approved ${spent} of ${cap} allowed actions.`,
    status: "held",
  };
}

/** Allowlist matching is deliberately narrow: exact kind or target. */
function allowlistHit(
  policy: Policy,
  draft: DraftCandidate,
): string | undefined {
  const allowlist = policy.allowlist ?? [];
  if (allowlist.length === 0) {
    return undefined;
  }
  const kind = normalize(draft.kind);
  const target = normalize(draft.target);
  return allowlist.find((entry) => {
    const value = normalize(entry);
    return value !== "" && (value === kind || value === target);
  });
}

/** Decide whether a reported draft runs itself, waits, or is held. */
export function evaluateDraft(
  policy: Policy,
  draft: DraftCandidate,
  context: { autoApprovedSoFar: number },
): DraftEvaluation {
  const held =
    holdOnThreshold(policy, draft) ??
    holdOnDenylist(policy, draft) ??
    holdOnRequireHuman(policy, draft) ??
    holdOnRunCap(policy, context);
  if (held) {
    return held;
  }

  const allowed = allowlistHit(policy, draft);
  if (allowed !== undefined) {
    return {
      allowed: true,
      clause: "allowlist",
      reason: `Allowlist entry "${allowed}" covers this action, so it ran automatically.`,
      status: "auto",
    };
  }

  return {
    allowed: true,
    reason: "No clause blocks this action, and no allowlist entry covers it.",
    status: "pending",
  };
}

function listDiff(
  label: string,
  before: readonly string[] | undefined,
  after: readonly string[] | undefined,
): string[] {
  const previous = new Set(before ?? []);
  const next = new Set(after ?? []);
  const added = [...next].filter((entry) => !previous.has(entry));
  const removed = [...previous].filter((entry) => !next.has(entry));
  return [
    ...(added.length > 0 ? [`${label} added: ${added.join(", ")}`] : []),
    ...(removed.length > 0 ? [`${label} removed: ${removed.join(", ")}`] : []),
  ];
}

function thresholdDiff(before: Policy, after: Policy): string[] {
  return listDiff(
    "threshold",
    (before.thresholds ?? []).map(thresholdClause).map(stripPrefix),
    (after.thresholds ?? []).map(thresholdClause).map(stripPrefix),
  );
}

function stripPrefix(clause: string): string {
  return clause.replace(/^threshold:/, "");
}

function notesDiff(before: Policy, after: Policy): string[] {
  const previous = before.notes ?? "";
  const next = after.notes ?? "";
  if (previous === next) {
    return [];
  }
  if (next === "") {
    return ["notes cleared"];
  }
  return [`notes: ${next}`];
}

/** Human-readable change lines for the policy diff the UI shows. */
export function diffPolicy(a: Policy, b: Policy): string[] {
  return [
    ...(a.maxAutoActionsPerRun !== b.maxAutoActionsPerRun
      ? [
          `maxAutoActionsPerRun: ${a.maxAutoActionsPerRun} -> ${b.maxAutoActionsPerRun}`,
        ]
      : []),
    ...thresholdDiff(a, b),
    ...listDiff("allowlist", a.allowlist, b.allowlist),
    ...listDiff("denylist", a.denylist, b.denylist),
    ...listDiff("requireHumanFor", a.requireHumanFor, b.requireHumanFor),
    ...notesDiff(a, b),
  ];
}

/** One paragraph a tool response can hand straight back to the agent. */
export function describePolicy(p: Policy): string {
  const thresholds = (p.thresholds ?? [])
    .map((threshold) => stripPrefix(thresholdClause(threshold)));
  const sentences = [
    p.maxAutoActionsPerRun === 0
      ? "Auto-approves nothing, so every action waits for a decision."
      : `Auto-approves at most ${p.maxAutoActionsPerRun} action(s) per run.`,
    (p.allowlist ?? []).length > 0
      ? `Only these run themselves: ${(p.allowlist ?? []).join(", ")}.`
      : "No allowlist is set, so nothing runs itself.",
    thresholds.length > 0
      ? `Holds anything that trips ${thresholds.join(" or ")}.`
      : "",
    (p.denylist ?? []).length > 0
      ? `Holds anything mentioning ${(p.denylist ?? []).join(" or ")}.`
      : "",
    (p.requireHumanFor ?? []).length > 0
      ? `Always asks a human for ${(p.requireHumanFor ?? []).join(", ")}.`
      : "",
    "Everything else waits as pending.",
  ];
  return sentences.filter((line) => line !== "").join(" ");
}
