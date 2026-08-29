/**
 * Turning one immutable Workspace into the patches that describe what changed.
 *
 * The store never mutates, so reference inequality is a sound "this entity changed"
 * test: a new Category object means somebody rewrote that category, and an untouched
 * one is the very same object it was before. That is the whole diff.
 */
import type { AuditEvent, MonitorRun, Workspace } from "../types";
import { ROOM_LIMITS, type PatchKind, type RoomPatch } from "./types";

interface Ctx {
  readonly origin: string;
  readonly at: string;
}

function patch(kind: PatchKind, key: string, value: unknown, ctx: Ctx): RoomPatch {
  return { kind, key, value, at: ctx.at, origin: ctx.origin };
}

/** Added, replaced and removed entries of a keyed record. */
function recordPatches<T>(
  kind: PatchKind,
  prev: Readonly<Record<string, T>>,
  next: Readonly<Record<string, T>>,
  ctx: Ctx,
): readonly RoomPatch[] {
  const out: RoomPatch[] = [];
  for (const [key, value] of Object.entries(next)) {
    if (prev[key] !== value) out.push(patch(kind, key, value, ctx));
  }
  for (const key of Object.keys(prev)) {
    if (!(key in next)) out.push(patch(kind, key, null, ctx));
  }
  return out;
}

/** Arrays of records with their own ids (runs, audit) behave like keyed records. */
function listPatches<T>(
  kind: PatchKind,
  prev: readonly T[],
  next: readonly T[],
  idOf: (item: T) => string,
  ctx: Ctx,
  withDeletes: boolean,
): readonly RoomPatch[] {
  const before = new Map(prev.map((item) => [idOf(item), item]));
  const out: RoomPatch[] = [];
  for (const item of next) {
    const key = idOf(item);
    if (before.get(key) !== item) out.push(patch(kind, key, item, ctx));
    before.delete(key);
  }
  if (withDeletes) {
    for (const key of before.keys()) out.push(patch(kind, key, null, ctx));
  }
  return out;
}

const runId = (run: MonitorRun): string => run.id;
const eventId = (event: AuditEvent): string => event.id;

/**
 * Everything that changed between two versions of the same board.
 *
 * Audit only ever grows here: an event dropped locally because the 500 event cap rolled
 * over is not a deletion anybody else should replay, so audit deletes are never sent.
 */
export function derivePatches(prev: Workspace, next: Workspace, origin: string, at: string): readonly RoomPatch[] {
  if (prev === next) return [];
  const ctx: Ctx = { origin, at };
  const overview: readonly RoomPatch[] =
    prev.overview === next.overview ? [] : [patch("overview", "overview", next.overview ?? null, ctx)];
  return [
    ...recordPatches("category", prev.categories, next.categories, ctx),
    ...overview,
    ...recordPatches("monitor", prev.monitors, next.monitors, ctx),
    ...recordPatches("draft", prev.drafts, next.drafts, ctx),
    ...recordPatches("feedback", prev.feedback, next.feedback, ctx),
    ...recordPatches("claim", prev.claims ?? {}, next.claims ?? {}, ctx),
    ...recordPatches("write", prev.lastWriter ?? {}, next.lastWriter ?? {}, ctx),
    ...listPatches("run", prev.runs, next.runs, runId, ctx, true),
    ...listPatches("audit", prev.audit, next.audit, eventId, ctx, false),
  ];
}

/**
 * How much board a browser is holding. Zero means "I am a joiner, not a source": an empty
 * board never answers a snapshot request, because answering with nothing is how a room
 * full of work gets emptied.
 */
export function boardSize(ws: Workspace): number {
  return (
    Object.keys(ws.categories).length +
    Object.keys(ws.monitors).length +
    Object.keys(ws.drafts).length +
    Object.keys(ws.feedback ?? {}).length +
    ws.runs.length +
    (ws.overview === undefined ? 0 : 1)
  );
}

/**
 * The same board with nothing on it. This is what a browser knows the room has been told
 * when it arrives: nothing. Starting the baseline here is what makes a peer offer its own
 * board on join instead of sitting on it, and a diff from here can only ever add.
 */
export function emptyLike(ws: Workspace): Workspace {
  return {
    ...ws,
    categories: {},
    overview: undefined,
    monitors: {},
    drafts: {},
    feedback: {},
    claims: {},
    lastWriter: {},
    runs: [],
    audit: [],
  };
}

/** Every entity on the board as patches, for answering a late joiner in one message. */
export function fullPatches(ws: Workspace, origin: string, at: string): readonly RoomPatch[] {
  return derivePatches(emptyLike(ws), ws, origin, at);
}

/**
 * True when a commit changed so much that shipping a whole snapshot beats shipping
 * patches (a clear_workspace, a seed, or the first fill of an empty board).
 */
export function tooManyPatches(patches: readonly RoomPatch[]): boolean {
  return patches.length > ROOM_LIMITS.patchesPerMessage;
}

/** Audit is capped per message so one busy board cannot flood another one's rail. */
export function capAuditPatches(patches: readonly RoomPatch[]): readonly RoomPatch[] {
  const audit = patches.filter((item) => item.kind === "audit");
  if (audit.length <= ROOM_LIMITS.auditPerMessage) return patches;
  const keep = new Set(audit.slice(-ROOM_LIMITS.auditPerMessage));
  return patches.filter((item) => item.kind !== "audit" || keep.has(item));
}
