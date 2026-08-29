/**
 * Defensive coercers for the operational half of a shared board: policies, monitors,
 * runs, drafts and feedback. Same rules as specs.ts: fresh objects, hard caps,
 * unknown keys dropped, nothing trusted.
 */
import type {
  Actor,
  Claim,
  ClaimTarget,
  ClaimTargetKind,
  DraftAction,
  DraftStatus,
  Decider,
  Feedback,
  FeedbackTarget,
  FeedbackTargetKind,
  Monitor,
  MonitorRun,
  Policy,
  Runner,
  Threshold,
  ThresholdOp,
  WriteMark,
} from "../types";
import { CAP } from "./caps";
import {
  asArray,
  asEnum,
  asFieldMap,
  asNumber,
  asOptionalEnum,
  asRecord,
  asString,
  asStringList,
  asText,
  asIso,
} from "./coerce";

const OPS: readonly ThresholdOp[] = ["gt", "gte", "lt", "lte", "eq"];
const RUNNERS: readonly Runner[] = ["local", "cloud", "demo"];
const STATUSES: readonly DraftStatus[] = ["pending", "held", "approved", "declined", "auto"];
const DECIDERS: readonly Decider[] = ["human", "agent", "policy"];
const ACTORS: readonly Actor[] = ["agent", "human", "system"];
/**
 * Every target a note can carry, including the three that address somebody rather than an
 * object. Widened for A15: without "agent", "room" and "person" here, a note handed to
 * another visitor's agent arrived in their browser as a plain dashboard note.
 */
const FEEDBACK_KINDS: readonly FeedbackTargetKind[] = [
  "dashboard",
  "overview",
  "draft",
  "monitor",
  "agent",
  "room",
  "person",
];

const CLAIM_KINDS: readonly ClaimTargetKind[] = ["dashboard", "overview", "monitor", "note"];
const HOLDER_KINDS: readonly Claim["holderKind"][] = ["agent", "person"];

const MAX_AUTO_ACTIONS = 999;

function coerceThreshold(raw: unknown): Threshold | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const field = asString(rec.field, CAP.label);
  const value = asNumber(rec.value);
  if (field === undefined || value === undefined) return null;
  const label = asString(rec.label, CAP.label);
  return { field, op: asEnum(rec.op, OPS, "gt"), value, ...(label ? { label } : {}) };
}

/** A policy is what a stranger's link claims the rules were. It is display only. */
export function coercePolicy(raw: unknown): Policy {
  const rec = asRecord(raw);
  if (rec === null) return { maxAutoActionsPerRun: 0 };
  const cap = asNumber(rec.maxAutoActionsPerRun) ?? 0;
  const thresholds: Threshold[] = [];
  for (const item of asArray(rec.thresholds, CAP.thresholds)) {
    const threshold = coerceThreshold(item);
    if (threshold !== null) thresholds.push(threshold);
  }
  const allowlist = asStringList(rec.allowlist, CAP.policyList, CAP.kind);
  const denylist = asStringList(rec.denylist, CAP.policyList, CAP.kind);
  const requireHumanFor = asStringList(rec.requireHumanFor, CAP.policyList, CAP.kind);
  const notes = asString(rec.notes, CAP.summary);
  return {
    maxAutoActionsPerRun: Math.max(0, Math.min(MAX_AUTO_ACTIONS, Math.floor(cap))),
    ...(thresholds.length > 0 ? { thresholds } : {}),
    ...(allowlist.length > 0 ? { allowlist } : {}),
    ...(denylist.length > 0 ? { denylist } : {}),
    ...(requireHumanFor.length > 0 ? { requireHumanFor } : {}),
    ...(notes ? { notes } : {}),
  };
}

export function coerceMonitor(raw: unknown, at: string): Monitor | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const id = asString(rec.id, CAP.label);
  const name = asString(rec.name, CAP.name);
  if (id === undefined || name === undefined) return null;
  const lastRunAt = asString(rec.lastRunAt, 40) ? asIso(rec.lastRunAt, at) : undefined;
  const nextRunAt = asString(rec.nextRunAt, 40) ? asIso(rec.nextRunAt, at) : undefined;
  return {
    id,
    name,
    category: asText(rec.category, CAP.name, "Uncategorised"),
    schedule: asText(rec.schedule, CAP.schedule, "on demand"),
    policy: coercePolicy(rec.policy),
    runner: asEnum(rec.runner, RUNNERS, "demo"),
    status: asEnum(rec.status, ["active", "paused"] as const, "active"),
    createdAt: asIso(rec.createdAt, at),
    ...(lastRunAt ? { lastRunAt } : {}),
    ...(nextRunAt ? { nextRunAt } : {}),
  };
}

export function coerceRun(raw: unknown, at: string): MonitorRun | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const id = asString(rec.id, CAP.label);
  const monitorId = asString(rec.monitorId, CAP.label);
  if (id === undefined || monitorId === undefined) return null;
  const finishedAt = asString(rec.finishedAt, 40) ? asIso(rec.finishedAt, at) : undefined;
  return {
    id,
    monitorId,
    runner: asEnum(rec.runner, RUNNERS, "demo"),
    startedAt: asIso(rec.startedAt, at),
    findings: asStringList(rec.findings, CAP.findings, CAP.summary),
    draftIds: asStringList(rec.draftIds, CAP.draftIds, CAP.label),
    ...(finishedAt ? { finishedAt } : {}),
  };
}

export function coerceDraft(raw: unknown, at: string): DraftAction | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const id = asString(rec.id, CAP.label);
  const summary = asString(rec.summary, CAP.summary);
  if (id === undefined || summary === undefined) return null;
  const amount = asNumber(rec.amount);
  const fields = asFieldMap(rec.fields, CAP.fields, CAP.label);
  const heldReason = asString(rec.heldReason, CAP.summary);
  const decidedBy = asOptionalEnum(rec.decidedBy, DECIDERS);
  const decidedAt = asString(rec.decidedAt, 40) ? asIso(rec.decidedAt, at) : undefined;
  return {
    id,
    monitorId: asText(rec.monitorId, CAP.label, "unknown"),
    runId: asText(rec.runId, CAP.label, "unknown"),
    kind: asText(rec.kind, CAP.kind, "action"),
    target: asText(rec.target, CAP.target, "unknown"),
    summary,
    status: asEnum(rec.status, STATUSES, "pending"),
    ...(amount === undefined ? {} : { amount }),
    ...(fields ? { fields } : {}),
    ...(heldReason ? { heldReason } : {}),
    ...(decidedBy ? { decidedBy } : {}),
    ...(decidedAt ? { decidedAt } : {}),
  };
}

function coerceTarget(raw: unknown): FeedbackTarget | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const id = asString(rec.id, CAP.name);
  if (id === undefined) return null;
  return { kind: asEnum(rec.kind, FEEDBACK_KINDS, "dashboard"), id };
}

export function coerceFeedback(raw: unknown, at: string): Feedback | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const id = asString(rec.id, CAP.label);
  const text = asString(rec.text, CAP.text);
  const target = coerceTarget(rec.target);
  if (id === undefined || text === undefined || target === null) return null;
  const resolvedAt = asString(rec.resolvedAt, 40) ? asIso(rec.resolvedAt, at) : undefined;
  const resolvedBy = asOptionalEnum(rec.resolvedBy, ACTORS);
  const resolution = asString(rec.resolution, CAP.text);
  const from = asString(rec.from, CAP.from);
  return {
    id,
    target,
    text,
    author: asEnum(rec.author, ACTORS, "human"),
    ...(from ? { from } : {}),
    createdAt: asIso(rec.createdAt, at),
    ...(resolvedAt ? { resolvedAt } : {}),
    ...(resolvedBy ? { resolvedBy } : {}),
    ...(resolution ? { resolution } : {}),
  };
}

/* ---------- turns: who is working on what, and who wrote last (docs/TURNS.md) ---------- */

function coerceClaimTarget(raw: unknown): ClaimTarget | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const id = asString(rec.id, CAP.name);
  const kind = asOptionalEnum(rec.kind, CLAIM_KINDS);
  if (id === undefined || kind === undefined) return null;
  return { kind, id };
}

/**
 * A claim from somebody else's browser. The expiry is theirs to state and ours to check:
 * a claim that arrives already expired is simply never live, so a hostile peer cannot
 * freeze this board by claiming everything forever.
 */
export function coerceClaim(raw: unknown, at: string): Claim | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const target = coerceClaimTarget(rec.target);
  const holder = asString(rec.holder, CAP.holder);
  if (target === null || holder === undefined) return null;
  const since = asIso(rec.since, at);
  return {
    target,
    holder,
    holderKind: asEnum(rec.holderKind, HOLDER_KINDS, "agent"),
    since,
    expiresAt: asIso(rec.expiresAt, since),
  };
}

export function coerceWriteMark(raw: unknown, at: string): WriteMark | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const by = asString(rec.by, CAP.holder);
  if (by === undefined) return null;
  return { at: asIso(rec.at, at), by, byKind: asEnum(rec.byKind, HOLDER_KINDS, "agent") };
}
