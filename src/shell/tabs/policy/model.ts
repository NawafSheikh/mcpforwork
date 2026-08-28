/**
 * The guardrail form model.
 *
 * The editor holds its state in this plain shape (values as typed, not as parsed) and
 * turns it into a Policy only when it needs one: for the live sentence, for the diff
 * and for the save. Everything here is pure, so the form, the JSON toggle and the
 * tests all agree on what a written clause means.
 */
import type { Policy, Threshold, ThresholdOp } from "../../../types";

export const MAX_AUTO_ACTIONS = 50;

/** Mirrors policySchema in src/webmcp/schemas.ts so the form can never write past it. */
export const CAPS = {
  thresholds: 10,
  allowlist: 50,
  denylist: 50,
  requireHumanFor: 20,
  entryChars: 60,
  fieldChars: 40,
  labelChars: 60,
  notesChars: 300,
} as const;

export const OPS: readonly ThresholdOp[] = ["gt", "gte", "lt", "lte", "eq"];

export const OP_SYMBOLS: Readonly<Record<ThresholdOp, string>> = {
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  eq: "=",
};

/** Offered in a datalist under the field input. The field itself stays free text. */
export const FIELD_SUGGESTIONS: readonly string[] = ["amount", "idleDays", "count", "days"];

/** One threshold as it is being typed: the value is text until it parses. */
export interface ThresholdRow {
  readonly id: string;
  readonly field: string;
  readonly op: ThresholdOp;
  readonly value: string;
  readonly label: string;
}

export type ChipListName = "requireHumanFor" | "allowlist" | "denylist";

export interface PolicyForm {
  readonly maxAutoActionsPerRun: number;
  readonly thresholds: readonly ThresholdRow[];
  readonly requireHumanFor: readonly string[];
  readonly allowlist: readonly string[];
  readonly denylist: readonly string[];
  readonly notes: string;
}

let sequence = 0;

/** Stable react key for a row. Rows outlive their own field values while typing. */
export function nextRowId(): string {
  sequence += 1;
  return `row_${sequence.toString(36)}`;
}

export function emptyRow(): ThresholdRow {
  return { id: nextRowId(), field: "amount", op: "gt", value: "", label: "" };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Text to a finite number. Spaces and thousands commas are tolerated, nothing else. */
export function readValue(raw: string): number | undefined {
  const cleaned = raw.replace(/[\s,]/g, "");
  if (cleaned === "") return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function rowOf(threshold: Threshold): ThresholdRow {
  return {
    id: nextRowId(),
    field: threshold.field,
    op: threshold.op,
    value: String(threshold.value),
    label: threshold.label ?? "",
  };
}

/** A saved policy opened in the form. Nothing is dropped and nothing is invented. */
export function toForm(policy: Policy): PolicyForm {
  return {
    maxAutoActionsPerRun: clamp(Math.floor(policy.maxAutoActionsPerRun) || 0, 0, MAX_AUTO_ACTIONS),
    thresholds: (policy.thresholds ?? []).map(rowOf),
    requireHumanFor: [...(policy.requireHumanFor ?? [])],
    allowlist: [...(policy.allowlist ?? [])],
    denylist: [...(policy.denylist ?? [])],
    notes: policy.notes ?? "",
  };
}

function cleanEntries(list: readonly string[], max: number): readonly string[] {
  const out: string[] = [];
  for (const raw of list) {
    const entry = raw.trim().slice(0, CAPS.entryChars);
    if (entry === "" || out.some((kept) => kept.toLowerCase() === entry.toLowerCase())) continue;
    if (out.length >= max) break;
    out.push(entry);
  }
  return out;
}

function cleanThresholds(rows: readonly ThresholdRow[]): readonly Threshold[] {
  const out: Threshold[] = [];
  for (const row of rows) {
    const field = row.field.trim().slice(0, CAPS.fieldChars);
    const value = readValue(row.value);
    if (field === "" || value === undefined || out.length >= CAPS.thresholds) continue;
    const label = row.label.trim().slice(0, CAPS.labelChars);
    out.push({ field, op: row.op, value, ...(label !== "" ? { label } : {}) });
  }
  return out;
}

/**
 * The form as a Policy. Rows and chips that cannot be read are dropped rather than
 * guessed, so the live preview keeps working while somebody is halfway through a rule.
 * formIssues names every one of those drops, and the save button waits for them.
 */
export function policyFromForm(form: PolicyForm): Policy {
  const thresholds = cleanThresholds(form.thresholds);
  const allowlist = cleanEntries(form.allowlist, CAPS.allowlist);
  const denylist = cleanEntries(form.denylist, CAPS.denylist);
  const requireHumanFor = cleanEntries(form.requireHumanFor, CAPS.requireHumanFor);
  const notes = form.notes.trim().slice(0, CAPS.notesChars);
  return {
    maxAutoActionsPerRun: clamp(Math.floor(form.maxAutoActionsPerRun) || 0, 0, MAX_AUTO_ACTIONS),
    ...(thresholds.length > 0 ? { thresholds } : {}),
    ...(allowlist.length > 0 ? { allowlist } : {}),
    ...(denylist.length > 0 ? { denylist } : {}),
    ...(requireHumanFor.length > 0 ? { requireHumanFor } : {}),
    ...(notes !== "" ? { notes } : {}),
  };
}

function rowIssue(row: ThresholdRow, index: number): string | null {
  const position = `Rule ${index + 1}`;
  if (row.field.trim() === "") return `${position} needs a field name, for example amount.`;
  if (readValue(row.value) === undefined) return `${position} needs a number to compare against.`;
  return null;
}

/** Everything the form would silently drop. Empty means the save button is live. */
export function formIssues(form: PolicyForm): readonly string[] {
  const max = form.maxAutoActionsPerRun;
  const capIssue =
    Number.isInteger(max) && max >= 0 && max <= MAX_AUTO_ACTIONS
      ? []
      : [`Max auto actions must be a whole number from 0 to ${MAX_AUTO_ACTIONS}.`];
  const rows = form.thresholds
    .map(rowIssue)
    .filter((issue): issue is string => issue !== null);
  const overflow =
    form.thresholds.length > CAPS.thresholds
      ? [`A policy holds at most ${CAPS.thresholds} rules.`]
      : [];
  return [...capIssue, ...rows, ...overflow];
}

/** The plain sentence under the stepper, written for whoever signs off on the run. */
export function autoActionsSentence(count: number): string {
  if (count === 0) return "Nothing runs automatically: every action waits for a person.";
  return `After ${count} automatic action${count === 1 ? "" : "s"} in one run, everything else waits for a person.`;
}

/** Add one chip. Blank and repeat entries are ignored rather than rejected loudly. */
export function addChip(list: readonly string[], raw: string, max: number): readonly string[] {
  const entry = raw.trim().slice(0, CAPS.entryChars);
  if (entry === "" || list.length >= max) return list;
  if (list.some((kept) => kept.toLowerCase() === entry.toLowerCase())) return list;
  return [...list, entry];
}

export function removeChip(list: readonly string[], entry: string): readonly string[] {
  return list.filter((kept) => kept !== entry);
}

export const CHIP_CAPS: Readonly<Record<ChipListName, number>> = {
  requireHumanFor: CAPS.requireHumanFor,
  allowlist: CAPS.allowlist,
  denylist: CAPS.denylist,
};
