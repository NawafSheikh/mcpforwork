/**
 * Applying somebody else's patches to this browser's board.
 *
 * Two rules, and nothing else decides:
 *   1. Last writer wins per (kind, key), compared on the patch's `at` and broken by the
 *      origin client id, so two browsers that never meet still converge on one answer.
 *   2. Every value goes through the same coercers a share link goes through, so a hostile
 *      or simply stale peer cannot put a shape on this board that the renderer cannot draw.
 *
 * Coercion happens once, in normalizePatches, and the resulting objects are then placed
 * into every workspace that needs them. That is not an optimisation: the sync engine folds
 * the same patches into the live board and into its "what the peers already hold" baseline,
 * and the diff between those two is by object identity. Coercing twice would produce two
 * equal-but-distinct objects, the diff would call that a change, and the room would echo
 * every message forever.
 *
 * The audit rail is the exception to rule 1: it is never overwritten and never deleted,
 * only merged by event id and capped, because a trail one peer can rewrite is not a trail.
 */
import { capAudit } from "../store/audit";
import {
  coerceClaim,
  coerceDraft,
  coerceFeedback,
  coerceMonitor,
  coerceRun,
  coerceWriteMark,
} from "../share/ops";
import { coerceCategory, coerceOverview } from "../share/specs";
import { isSafeKey } from "../share/coerce";
import type {
  AuditEvent,
  Category,
  Claim,
  DraftAction,
  Feedback,
  Monitor,
  MonitorRun,
  OverviewSpec,
  Workspace,
  WriteMark,
} from "../types";
import type { RoomPatch } from "./types";
import { coerceAuditEvent } from "./wire";

/** "kind:key" to "at|origin". Immutable, replaced wholesale on every applied patch. */
export type LwwClock = Readonly<Record<string, string>>;

interface PatchMeta {
  readonly key: string;
  readonly at: string;
  readonly origin: string;
}

/** A patch whose value has already survived coercion. null means "this entity is gone". */
export type NormalPatch =
  | (PatchMeta & { readonly kind: "category"; readonly value: Category | null })
  | (PatchMeta & { readonly kind: "overview"; readonly value: OverviewSpec | null })
  | (PatchMeta & { readonly kind: "monitor"; readonly value: Monitor | null })
  | (PatchMeta & { readonly kind: "run"; readonly value: MonitorRun | null })
  | (PatchMeta & { readonly kind: "draft"; readonly value: DraftAction | null })
  | (PatchMeta & { readonly kind: "feedback"; readonly value: Feedback | null })
  | (PatchMeta & { readonly kind: "claim"; readonly value: Claim | null })
  | (PatchMeta & { readonly kind: "write"; readonly value: WriteMark | null })
  | (PatchMeta & { readonly kind: "audit"; readonly value: AuditEvent });

export interface NormalizeResult {
  readonly patches: readonly NormalPatch[];
  readonly dropped: number;
  readonly reasons: readonly string[];
}

export interface ApplyResult {
  readonly ws: Workspace;
  readonly clock: LwwClock;
  readonly applied: number;
  /** Patches an older writer sent for something this board already changed later. */
  readonly stale: number;
  /** Patches whose value did not survive coercion. */
  readonly dropped: number;
  readonly reasons: readonly string[];
}

const MAX_REASONS = 4;
const clockKey = (patch: PatchMeta & { readonly kind: string }): string => `${patch.kind}:${patch.key}`;
const stampOf = (patch: PatchMeta): string => `${patch.at}|${patch.origin}`;

function splitStamp(stamp: string): { readonly at: string; readonly origin: string } {
  const cut = stamp.lastIndexOf("|");
  return cut < 0 ? { at: stamp, origin: "" } : { at: stamp.slice(0, cut), origin: stamp.slice(cut + 1) };
}

/**
 * ISO stamps are fixed width, so a plain string compare is a time compare, and appending
 * the origin breaks a dead heat the same way on every browser.
 *
 * One writer against itself is the exception. Two changes from the same browser inside the
 * same millisecond are common (a tool call and the clear right after it), and they are not
 * a conflict: that browser's messages arrive in the order it sent them, so its later word
 * always replaces its earlier one. Without this rule a same-millisecond delete loses to the
 * value it was meant to remove and the entity comes back from the dead.
 */
function wins(previous: string | undefined, next: string): boolean {
  if (previous === undefined) return true;
  const before = splitStamp(previous);
  const after = splitStamp(next);
  if (before.origin === after.origin) return before.at <= after.at;
  return previous < next;
}

function dropKey<T>(rec: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> {
  if (!Object.prototype.hasOwnProperty.call(rec, key)) return rec;
  const out: Record<string, T> = {};
  for (const [existing, value] of Object.entries(rec)) {
    if (existing !== key) out[existing] = value;
  }
  return out;
}

function putRun(runs: readonly MonitorRun[], run: MonitorRun): readonly MonitorRun[] {
  const index = runs.findIndex((item) => item.id === run.id);
  if (index < 0) return [...runs, run];
  return runs.map((item, position) => (position === index ? run : item));
}

/** Merge by id, oldest first, then cap. Nothing already in the rail is replaced. */
export function mergeAudit(
  existing: readonly AuditEvent[],
  incoming: readonly AuditEvent[],
): readonly AuditEvent[] {
  const seen = new Set(existing.map((event) => event.id));
  const fresh = incoming.filter((event) => !seen.has(event.id));
  if (fresh.length === 0) return existing;
  const merged = [...existing, ...fresh].sort((a, b) => a.at.localeCompare(b.at));
  return capAudit(merged);
}

/** null means the raw value did not survive coercion, so the whole patch is dropped. */
function normalizeOne(patch: RoomPatch, at: string): NormalPatch | null {
  const meta: PatchMeta = { key: patch.key, at: patch.at, origin: patch.origin };
  const gone = patch.value === null;
  switch (patch.kind) {
    case "category":
      return gone
        ? { ...meta, kind: "category", value: null }
        : wrap(meta, "category", coerceCategory(patch.value, patch.key, at));
    case "overview":
      return gone
        ? { ...meta, kind: "overview", value: null }
        : wrap(meta, "overview", coerceOverview(patch.value, at));
    case "monitor":
      return gone
        ? { ...meta, kind: "monitor", value: null }
        : wrap(meta, "monitor", coerceMonitor(patch.value, at));
    case "run":
      return gone ? { ...meta, kind: "run", value: null } : wrap(meta, "run", coerceRun(patch.value, at));
    case "draft":
      return gone ? { ...meta, kind: "draft", value: null } : wrap(meta, "draft", coerceDraft(patch.value, at));
    case "feedback":
      return gone
        ? { ...meta, kind: "feedback", value: null }
        : wrap(meta, "feedback", coerceFeedback(patch.value, at));
    case "claim":
      return gone
        ? { ...meta, kind: "claim", value: null }
        : wrap(meta, "claim", coerceClaim(patch.value, at));
    case "write":
      return gone
        ? { ...meta, kind: "write", value: null }
        : wrap(meta, "write", coerceWriteMark(patch.value, at));
    case "audit": {
      const event = coerceAuditEvent(patch.value, at);
      return event === null ? null : { ...meta, kind: "audit", value: event };
    }
    default:
      return null;
  }
}

/** One cast, in one place: the kind and the coercer that produced the value agree by construction. */
function wrap<T>(meta: PatchMeta, kind: NormalPatch["kind"], value: T | null): NormalPatch | null {
  return value === null ? null : ({ ...meta, kind, value } as NormalPatch);
}

/**
 * The key the entity will actually be stored under, which is its own id or name rather
 * than the key the sender claimed. Checked against the prototype chain before placement,
 * the same rule src/share applies to a snapshot: a category called __proto__ is dropped.
 */
function effectiveKey(patch: NormalPatch): string {
  if (patch.value === null) return patch.key;
  switch (patch.kind) {
    case "category":
      return patch.value.name;
    case "claim":
      return `${patch.value.target.kind}:${patch.value.target.id}`;
    case "monitor":
    case "run":
    case "draft":
    case "feedback":
    case "audit":
      return patch.value.id;
    default:
      return patch.key;
  }
}

export function normalizePatches(patches: readonly RoomPatch[], at: string): NormalizeResult {
  const out: NormalPatch[] = [];
  const reasons: string[] = [];
  let dropped = 0;
  for (const patch of patches) {
    const normal = normalizeOne(patch, at);
    if (normal !== null && !isSafeKey(effectiveKey(normal))) {
      dropped += 1;
      if (reasons.length < MAX_REASONS) reasons.push(`${patch.kind}:unsafe-key`);
      continue;
    }
    if (normal === null) {
      dropped += 1;
      if (reasons.length < MAX_REASONS) reasons.push(`${patch.kind}:${patch.key}`);
      continue;
    }
    out.push(normal);
  }
  return { patches: out, dropped, reasons };
}

function place(ws: Workspace, patch: NormalPatch): Workspace {
  switch (patch.kind) {
    case "category":
      return patch.value === null
        ? { ...ws, categories: dropKey(ws.categories, patch.key) }
        : { ...ws, categories: { ...ws.categories, [patch.value.name]: patch.value } };
    case "overview":
      return { ...ws, overview: patch.value ?? undefined };
    case "monitor":
      return patch.value === null
        ? { ...ws, monitors: dropKey(ws.monitors, patch.key) }
        : { ...ws, monitors: { ...ws.monitors, [patch.value.id]: patch.value } };
    case "draft":
      return patch.value === null
        ? { ...ws, drafts: dropKey(ws.drafts, patch.key) }
        : { ...ws, drafts: { ...ws.drafts, [patch.value.id]: patch.value } };
    case "feedback":
      return patch.value === null
        ? { ...ws, feedback: dropKey(ws.feedback, patch.key) }
        : { ...ws, feedback: { ...ws.feedback, [patch.value.id]: patch.value } };
    case "claim":
      return patch.value === null
        ? { ...ws, claims: dropKey(ws.claims ?? {}, patch.key) }
        : { ...ws, claims: { ...ws.claims, [effectiveKey(patch)]: patch.value } };
    case "write":
      return patch.value === null
        ? { ...ws, lastWriter: dropKey(ws.lastWriter ?? {}, patch.key) }
        : { ...ws, lastWriter: { ...ws.lastWriter, [patch.key]: patch.value } };
    case "run":
      return patch.value === null
        ? { ...ws, runs: ws.runs.filter((run) => run.id !== patch.key) }
        : { ...ws, runs: putRun(ws.runs, patch.value) };
    case "audit":
      return { ...ws, audit: mergeAudit(ws.audit, [patch.value]) };
    default:
      return ws;
  }
}

/** True when this patch is the latest word on its entity. Audit never competes. */
export function isFresh(clock: LwwClock, patch: NormalPatch | RoomPatch): boolean {
  return patch.kind === "audit" || wins(clock[clockKey(patch)], stampOf(patch));
}

/** Record a change so a remote patch that predates it cannot undo it. */
export function noteLocal(clock: LwwClock, patches: readonly (NormalPatch | RoomPatch)[]): LwwClock {
  if (patches.length === 0) return clock;
  const out: Record<string, string> = { ...clock };
  for (const patch of patches) {
    if (patch.kind === "audit") continue;
    const key = clockKey(patch);
    const stamp = stampOf(patch);
    if (wins(out[key], stamp)) out[key] = stamp;
  }
  return out;
}

/** Fold already-coerced patches into a board. Never throws, never partially applies one. */
export function applyNormalized(
  ws: Workspace,
  patches: readonly NormalPatch[],
  clock: LwwClock,
): { readonly ws: Workspace; readonly clock: LwwClock; readonly applied: number; readonly stale: number } {
  let current = ws;
  let nextClock = clock;
  let applied = 0;
  let stale = 0;
  for (const patch of patches) {
    if (!isFresh(nextClock, patch)) {
      stale += 1;
      continue;
    }
    current = place(current, patch);
    nextClock = noteLocal(nextClock, [patch]);
    applied += 1;
  }
  return { ws: current, clock: nextClock, applied, stale };
}

/** Coerce then fold. The one-shot form, used by tests and by anything not keeping a baseline. */
export function applyPatches(
  ws: Workspace,
  patches: readonly RoomPatch[],
  clock: LwwClock,
  now: Date = new Date(),
): ApplyResult {
  const normalized = normalizePatches(patches, now.toISOString());
  const folded = applyNormalized(ws, normalized.patches, clock);
  return { ...folded, dropped: normalized.dropped, reasons: normalized.reasons };
}
