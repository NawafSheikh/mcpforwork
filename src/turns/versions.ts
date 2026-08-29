/**
 * Versions: whose input counts (docs/TURNS.md).
 *
 * Reads hand back an `updatedAt` and a write may carry it back as `expectedUpdatedAt`.
 * A write built on a copy that has since changed is not refused: it is merged with what
 * is on the board and the reply says what was kept. The same is true of a write that
 * lands inside LIMITS.conflictSeconds of somebody else's, with or without the stamp.
 * Only a genuine collision, the same field changed twice, is sent back to be read again.
 *
 * The stamp is the object's own updatedAt wherever it has one, so the number an agent
 * reads back and the number it sends are the same number. Objects without one (a monitor,
 * a note) fall back to the write mark this board keeps, and to their creation time.
 */
import { LIMITS, type ClaimTarget, type Workspace, type WriteMark } from "../types";
import { claimKey, clockTime } from "./claims";

/** The read tool that hands back a fresh stamp for each kind of object. */
const READ_TOOL: Readonly<Record<ClaimTarget["kind"], string>> = {
  dashboard: "get_dashboard",
  overview: "get_workspace",
  monitor: "list_monitors",
  note: "list_feedback",
};

/** The stamp the object carries itself, when it carries one. */
function intrinsicUpdatedAt(ws: Workspace, target: ClaimTarget): string | undefined {
  if (target.kind === "dashboard") return ws.categories[target.id]?.dashboard?.updatedAt;
  if (target.kind === "overview") return ws.overview?.updatedAt;
  if (target.kind === "monitor") {
    const monitor = ws.monitors[target.id];
    return monitor === undefined ? undefined : monitor.createdAt;
  }
  const note = ws.feedback?.[target.id];
  return note?.resolvedAt ?? note?.createdAt;
}

/** What a read returns and what a write is checked against. Undefined when nothing is there. */
export function objectUpdatedAt(ws: Workspace, target: ClaimTarget): string | undefined {
  return ws.lastWriter?.[claimKey(target)]?.at ?? intrinsicUpdatedAt(ws, target);
}

/** Who touched this object last, for the refusal line and the rail. */
export function lastWriterOf(ws: Workspace, target: ClaimTarget): WriteMark | undefined {
  return ws.lastWriter?.[claimKey(target)];
}

function capMarks(marks: Record<string, WriteMark>): Record<string, WriteMark> {
  const entries = Object.entries(marks);
  if (entries.length <= LIMITS.maxWriteMarks) return marks;
  const ordered = [...entries].sort(([, a], [, b]) => a.at.localeCompare(b.at));
  return Object.fromEntries(ordered.slice(entries.length - LIMITS.maxWriteMarks));
}

export interface WriterInput {
  readonly by: string;
  readonly byKind: WriteMark["byKind"];
}

/**
 * Record who wrote an object. The stamp is taken from the object itself where possible,
 * so the value a later get_dashboard returns is the value this mark holds.
 */
export function markWrite(
  ws: Workspace,
  target: ClaimTarget,
  writer: WriterInput,
  now: Date = new Date(),
): Workspace {
  const mark: WriteMark = {
    at: intrinsicUpdatedAt(ws, target) ?? now.toISOString(),
    by: writer.by,
    byKind: writer.byKind,
  };
  return { ...ws, lastWriter: capMarks({ ...ws.lastWriter, [claimKey(target)]: mark }) };
}

/** True when the caller read an older version of this object than the one on the board. */
export function isStale(ws: Workspace, target: ClaimTarget, expected: string | undefined): boolean {
  if (expected === undefined || expected.trim().length === 0) return false;
  const current = objectUpdatedAt(ws, target);
  if (current === undefined) return false;
  return Date.parse(current) !== Date.parse(expected) && current !== expected;
}

/** "20 s" or "4 min": how long ago somebody else touched this. */
export function agoText(fromIso: string, now: Date = new Date()): string {
  const ms = now.getTime() - Date.parse(fromIso);
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const seconds = Math.round(ms / 1000);
  return seconds < 90 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
}

/**
 * Somebody else's write on this object inside the conflict window, or null. This is what
 * turns a blind overwrite into a merge; outside the window a write is just a write.
 */
export function recentWriter(
  ws: Workspace,
  target: ClaimTarget,
  caller: string | undefined,
  now: Date = new Date(),
): WriteMark | null {
  const mark = lastWriterOf(ws, target);
  if (mark === undefined) return null;
  const mine = caller?.trim().toLowerCase();
  if (mine !== undefined && mine.length > 0 && mark.by.trim().toLowerCase() === mine) return null;
  const age = now.getTime() - Date.parse(mark.at);
  return Number.isFinite(age) && age >= 0 && age < LIMITS.conflictSeconds * 1000 ? mark : null;
}

/** Who last touched this object, in words, for a merge line or a refusal. */
export function writerName(ws: Workspace, target: ClaimTarget): string {
  return lastWriterOf(ws, target)?.by ?? "somebody else";
}

/** The read to call again when a write really does collide. */
export function readToolFor(target: ClaimTarget): string {
  return READ_TOOL[target.kind];
}

/** Kept for the rail and the UI: when the object last moved, in clock form. */
export function changedAtText(ws: Workspace, target: ClaimTarget): string {
  const current = objectUpdatedAt(ws, target);
  return current === undefined ? "an unknown time" : clockTime(current);
}
