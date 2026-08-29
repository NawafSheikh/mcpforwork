/**
 * The turn gate: what happens around every agent write (docs/TURNS.md).
 *
 * Nothing here asks anybody for permission. Before the handler runs, a write that lands on
 * top of somebody else's recent change, or that was built on a copy which has since moved,
 * is merged with what is on the board: charts by id, KPIs by label, notes appended. The
 * reply says what was kept. Only a true collision, the same chart or the same KPI changed
 * twice, comes back unapplied with the one call that fixes it.
 *
 * After the handler runs, the caller's claim is taken or refreshed automatically, or
 * released when the write was the one that finishes the work, and the last writer is
 * recorded. No agent ever has to ask for a turn to get one.
 */
import type { Chart, ClaimTarget, ClaimTargetKind, KPI, Workspace } from "../types";
import { stableStringify } from "../store/audit";
import {
  AGENT_FALLBACK,
  CLAIM_KINDS,
  claimOn,
  dropClaim,
  holdClaim,
  isHolder,
} from "./claims";
import { listNames, mergeParts, type MergeParts } from "./merge";
import {
  agoText,
  isStale,
  markWrite,
  objectUpdatedAt,
  readToolFor,
  recentWriter,
  writerName,
} from "./versions";

/** The writes that hand the turn back, because they are the work being done. */
export const FINISHING_TOOLS: readonly string[] = [
  "upsert_dashboard",
  "compose_overview",
  "set_policy",
  "resolve_feedback",
];

/** The writes that carry an optional expectedUpdatedAt. */
export const VERSIONED_TOOLS: readonly string[] = [
  "upsert_dashboard",
  "compose_overview",
  "set_policy",
];

export interface GateOutcome {
  readonly next?: Workspace;
  readonly result: string;
}

/** What the registry does with this call: run it (possibly rewritten), or hand it back. */
export interface TurnDecision {
  /** Set when the write cannot be applied without deleting somebody's work. */
  readonly refusal?: string;
  /** The input the handler should run, merged where the board had more than the caller. */
  readonly input: unknown;
  /** A sentence appended to the reply, empty when there was nothing to say. */
  readonly note: string;
}

function record(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function field(input: unknown, key: string): string | undefined {
  const value = record(input)[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function list<T>(value: unknown): readonly T[] {
  return Array.isArray(value) ? (value as readonly T[]) : [];
}

/** Which object a tool call writes to, or null when it touches nothing claimable. */
export function writeTarget(name: string, input: unknown): ClaimTarget | null {
  if (name === "upsert_dashboard" || name === "upsert_dataset_summary" || name === "create_category") {
    const category = field(input, "category") ?? field(input, "name");
    return category === undefined ? null : { kind: "dashboard", id: category };
  }
  if (name === "compose_overview") return { kind: "overview", id: "overview" };
  if (name === "set_policy" || name === "report_monitor_run") {
    const monitorId = field(input, "monitorId");
    return monitorId === undefined ? null : { kind: "monitor", id: monitorId };
  }
  if (name === "resolve_feedback") {
    const feedbackId = field(input, "feedbackId");
    return feedbackId === undefined ? null : { kind: "note", id: feedbackId };
  }
  return null;
}

/** The {kind, id} a claim or release call names, or null when it is not a claim target. */
export function readClaimTarget(input: unknown): ClaimTarget | null {
  const raw = record(input).target;
  if (typeof raw !== "object" || raw === null) return null;
  const { kind, id } = raw as { kind?: unknown; id?: unknown };
  if (typeof kind !== "string" || typeof id !== "string" || id.trim().length === 0) return null;
  if (!(CLAIM_KINDS as readonly string[]).includes(kind)) return null;
  return { kind: kind as ClaimTargetKind, id: id.trim() };
}

/** The board's version of the object, in the three parts a merge understands. */
function currentParts(ws: Workspace, target: ClaimTarget): MergeParts | null {
  if (target.kind === "dashboard") {
    const spec = ws.categories[target.id]?.dashboard;
    return spec === undefined ? null : { kpis: spec.kpis, charts: spec.charts, lines: spec.notes ?? [] };
  }
  if (target.kind === "overview") {
    const spec = ws.overview;
    return spec === undefined ? null : { kpis: spec.kpis, charts: spec.charts, lines: spec.highlights ?? [] };
  }
  return null;
}

const LINE_KEY: Readonly<Record<string, string>> = { dashboard: "notes", overview: "highlights" };

function incomingParts(input: unknown, target: ClaimTarget): MergeParts {
  const raw = record(input);
  return {
    kpis: list<KPI>(raw.kpis),
    charts: list<Chart>(raw.charts),
    lines: list<string>(raw[LINE_KEY[target.kind] ?? "notes"]),
  };
}

const overwriteText = (who: string, ago: string, what: string, target: ClaimTarget): string =>
  `${who} changed ${what} ${ago} ago and this would delete it. Call ${readToolFor(target)} again, then send your change on top.`;

const onTopText = (who: string, ago: string): string =>
  ` ${who} changed this ${ago} ago; your change was applied on top.`;

const mergedText = (who: string, ago: string, kept: string): string =>
  ` ${who} changed this ${ago} ago; your change was applied on top and their ${kept} kept.`;

/**
 * Two policies are the same policy when they say the same thing. An empty allowlist and a
 * missing one are the same rule, and the stored form carries both, so they are compared
 * on what is actually set rather than on their JSON.
 */
function policySaid(policy: unknown): string {
  const clean = Object.entries(record(policy)).filter(
    ([, value]) => value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0),
  );
  return stableStringify(Object.fromEntries(clean));
}

/** A policy is one field, so a fresh change under a fresh change is a real collision. */
function policyDecision(ws: Workspace, input: unknown, target: ClaimTarget, who: string, ago: string): TurnDecision {
  const current = ws.monitors[target.id]?.policy;
  if (current === undefined || policySaid(current) === policySaid(record(input).policy)) {
    return { input, note: "" };
  }
  return { refusal: overwriteText(who, ago, "this policy", target), input, note: "" };
}

function specDecision(
  ws: Workspace,
  input: unknown,
  target: ClaimTarget,
  who: string,
  ago: string,
): TurnDecision {
  const current = currentParts(ws, target);
  if (current === null) return { input, note: "" };
  const outcome = mergeParts(current, incomingParts(input, target));
  if (outcome.conflicts.length > 0) {
    return { refusal: overwriteText(who, ago, listNames(outcome.conflicts), target), input, note: "" };
  }
  const lineKey = LINE_KEY[target.kind] ?? "notes";
  const merged = {
    ...record(input),
    kpis: outcome.merged.kpis,
    charts: outcome.merged.charts,
    [lineKey]: outcome.merged.lines,
  };
  const note =
    outcome.kept.length > 0 ? mergedText(who, ago, listNames(outcome.kept)) : onTopText(who, ago);
  return { input: merged, note };
}

/**
 * What to do with this write. Merged input and a sentence in the common case, a refusal
 * only when the same field was changed twice inside the window.
 */
export function openTurn(
  ws: Workspace,
  name: string,
  input: unknown,
  caller: string | undefined,
  now: Date = new Date(),
): TurnDecision {
  const target = writeTarget(name, input);
  if (target === null) return { input, note: "" };
  const mark = recentWriter(ws, target, caller, now);
  const stale = isStale(ws, target, field(input, "expectedUpdatedAt"));
  if (mark === null && !stale) return { input, note: "" };
  const who = mark?.by ?? writerName(ws, target);
  const ago = agoText(mark?.at ?? objectUpdatedAt(ws, target) ?? now.toISOString(), now);
  if (name === "set_policy") return policyDecision(ws, input, target, who, ago);
  if (name === "upsert_dashboard" || name === "compose_overview") {
    return specDecision(ws, input, target, who, ago);
  }
  return { input, note: onTopText(who, ago) };
}

/**
 * Fold the claim and the write mark into whatever workspace the handler produced. Any
 * write takes the turn for its caller; the write that finishes the work gives it back.
 */
export function settleTurn(
  name: string,
  input: unknown,
  outcome: GateOutcome,
  caller: string | undefined,
  now: Date = new Date(),
): GateOutcome {
  if (outcome.next === undefined) return outcome;
  const target = writeTarget(name, input);
  if (target === null) return outcome;
  const by = caller?.trim() || AGENT_FALLBACK;
  const marked = markWrite(outcome.next, target, { by, byKind: "agent" }, now);
  const held = claimOn(marked, target, now);
  if (FINISHING_TOOLS.includes(name)) {
    const next = held === null || isHolder(held, by) ? dropClaim(marked, target, now) : marked;
    return { ...outcome, next };
  }
  return { ...outcome, next: holdClaim(marked, { target, holder: by, holderKind: "agent" }, now) };
}
