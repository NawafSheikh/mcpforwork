/**
 * The snapshot that travels in a share link.
 *
 * Out: everything a reader needs to look at the board: categories, overview, monitors,
 * runs, drafts, feedback, the live turns, the loops, the capability cards and the pack
 * switches. The audit trail is deliberately left behind: it is the record of who did what
 * on this machine, so it is not somebody else's to read.
 *
 * Everything a room syncs as a patch has to be in here too. A room snapshot is built from
 * this codec, so a field missing here is a field a late joiner silently never receives:
 * that is exactly how loops, the capability cards and the host's pack switches went
 * missing from a joining browser until 30 Aug.
 *
 * In: a Workspace rebuilt field by field from untrusted JSON, in demo mode, named
 * "<name> (shared)". Nothing is ever spread from the parsed object.
 */
import type {
  Capability,
  Category,
  Claim,
  DraftAction,
  Feedback,
  Loop,
  Monitor,
  MonitorRun,
  PackState,
  Workspace,
  WriteMark,
} from "../types";
import { coerceCapability } from "../capabilities/coerce";
import { coerceLoop } from "../loops/coerce";
import { coercePackState } from "../packs/coerce";
import { CAP } from "./caps";
import { asArray, asRecord, asString, asText, asIso, isSafeKey } from "./coerce";
import { coerceCategory, coerceOverview } from "./specs";
import { coerceClaim, coerceDraft, coerceFeedback, coerceMonitor, coerceRun, coerceWriteMark } from "./ops";

export const SNAPSHOT_VERSION = 1;
export const SHARED_SUFFIX = " (shared)";

export interface Snapshot {
  readonly v: number;
  readonly id: string;
  readonly name: string;
  readonly categories: Readonly<Record<string, Category>>;
  readonly overview?: Workspace["overview"];
  readonly monitors: Readonly<Record<string, Monitor>>;
  readonly runs: readonly MonitorRun[];
  readonly drafts: Readonly<Record<string, DraftAction>>;
  readonly feedback: Readonly<Record<string, Feedback>>;
  /** Live turns travel too, so a late joiner sees who is mid-edit (docs/TURNS.md). */
  readonly claims: Readonly<Record<string, Claim>>;
  readonly lastWriter: Readonly<Record<string, WriteMark>>;
  /** What is running and where, so a joiner sees the picture rather than an empty one. */
  readonly loops: Readonly<Record<string, Loop>>;
  /** Who can reach what, so a joiner can address a request without waiting for a change. */
  readonly capabilities: Readonly<Record<string, Capability>>;
  /** The switches the host has moved, so a joiner inherits them instead of the defaults. */
  readonly packs: Readonly<Record<string, PackState>>;
  readonly updatedAt: string;
}

/** Read-only projection of a workspace. The audit trail never leaves the machine. */
export function toSnapshot(ws: Workspace): Snapshot {
  return {
    v: SNAPSHOT_VERSION,
    id: ws.id,
    name: ws.name,
    categories: ws.categories,
    ...(ws.overview ? { overview: ws.overview } : {}),
    monitors: ws.monitors,
    runs: ws.runs,
    drafts: ws.drafts,
    feedback: ws.feedback,
    claims: ws.claims ?? {},
    lastWriter: ws.lastWriter ?? {},
    loops: ws.loops ?? {},
    capabilities: ws.capabilities ?? {},
    packs: ws.packs ?? {},
    updatedAt: ws.updatedAt,
  };
}

/** Rebuild a keyed record from an untrusted record, keyed by the item's own id. */
function mapRecord<T>(
  raw: unknown,
  max: number,
  one: (item: unknown) => T | null,
  keyOf: (item: T) => string,
): Readonly<Record<string, T>> {
  const rec = asRecord(raw);
  if (rec === null) return {};
  const out: Record<string, T> = {};
  let kept = 0;
  for (const value of Object.values(rec)) {
    if (kept >= max) break;
    const item = one(value);
    if (item === null) continue;
    const key = keyOf(item);
    if (!isSafeKey(key)) continue;
    out[key] = item;
    kept += 1;
  }
  return out;
}

/**
 * A record keyed by its own key, or by whatever keyOf derives from the coerced value:
 * the "<kind>:<id>" maps of the turn model are keyed by the claim's own target, so a
 * stranger cannot file a claim under a key that does not match the object it names.
 */
function keyedRecord<T>(
  raw: unknown,
  max: number,
  one: (item: unknown) => T | null,
  keyOf?: (item: T) => string,
): Readonly<Record<string, T>> {
  const rec = asRecord(raw);
  if (rec === null) return {};
  const out: Record<string, T> = {};
  let kept = 0;
  for (const [rawKey, value] of Object.entries(rec)) {
    if (kept >= max) break;
    const item = one(value);
    if (item === null) continue;
    const key = asString(keyOf ? keyOf(item) : rawKey, CAP.name);
    if (key === undefined || !isSafeKey(key)) continue;
    out[key] = item;
    kept += 1;
  }
  return out;
}

function readCategories(raw: unknown, at: string): Readonly<Record<string, Category>> {
  const rec = asRecord(raw);
  if (rec === null) return {};
  const out: Record<string, Category> = {};
  let kept = 0;
  for (const [rawKey, value] of Object.entries(rec)) {
    if (kept >= CAP.categories) break;
    const key = asString(rawKey, CAP.name);
    if (key === undefined || !isSafeKey(key)) continue;
    const category = coerceCategory(value, key, at);
    if (category === null || !isSafeKey(category.name)) continue;
    out[category.name] = category;
    kept += 1;
  }
  return out;
}

function readRuns(raw: unknown, at: string): readonly MonitorRun[] {
  const out: MonitorRun[] = [];
  for (const item of asArray(raw, CAP.runs)) {
    const run = coerceRun(item, at);
    if (run !== null) out.push(run);
  }
  return out;
}

/** Trim any suffix we added before, so a re-share never says "(shared) (shared)". */
function sharedName(raw: unknown): string {
  const name = asText(raw, CAP.name, "Shared board");
  const base = name.endsWith(SHARED_SUFFIX) ? name.slice(0, -SHARED_SUFFIX.length) : name;
  return (base.trim() || "Shared board") + SHARED_SUFFIX;
}

/**
 * Untrusted JSON to a Workspace. Always demo mode, always an empty audit trail:
 * a snapshot is something to look at, not a board that is running.
 */
export function fromSnapshot(raw: unknown, now: Date = new Date()): Workspace | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const at = now.toISOString();
  const overview = coerceOverview(rec.overview, at);
  return {
    id: asText(rec.id, CAP.label, "ws_shared"),
    name: sharedName(rec.name),
    mode: "local",
    categories: readCategories(rec.categories, at),
    ...(overview ? { overview } : {}),
    monitors: mapRecord(rec.monitors, CAP.monitors, (i) => coerceMonitor(i, at), (m) => m.id),
    runs: readRuns(rec.runs, at),
    drafts: mapRecord(rec.drafts, CAP.drafts, (i) => coerceDraft(i, at), (d) => d.id),
    feedback: mapRecord(rec.feedback, CAP.feedback, (i) => coerceFeedback(i, at), (f) => f.id),
    claims: keyedRecord(
      rec.claims,
      CAP.claims,
      (i) => coerceClaim(i, at),
      (claim) => `${claim.target.kind}:${claim.target.id}`,
    ),
    lastWriter: keyedRecord(rec.lastWriter, CAP.writeMarks, (i) => coerceWriteMark(i, at)),
    loops: mapRecord(rec.loops, CAP.loops, (i) => coerceLoop(i, at), (loop) => loop.id),
    capabilities: mapRecord(
      rec.capabilities,
      CAP.capabilities,
      (i) => coerceCapability(i, at),
      (card) => card.owner.name,
    ),
    packs: mapRecord(rec.packs, CAP.packs, (i) => coercePackState(i, at), (pack) => pack.id),
    audit: [],
    updatedAt: asIso(rec.updatedAt, at),
  };
}
