/**
 * Loops: the process table of this OS, and the rules that keep the picture readable.
 *
 * A loop is something that keeps running somewhere. It belongs to one machine, sits in a
 * layer, and feeds a loop in a layer above it. Those three facts are the whole model, and
 * they are enough to draw what is actually happening across several people's machines.
 *
 * Two invariants, enforced here rather than hoped for:
 *   1. A loop feeds strictly upward. Sideways and downward are refused, which is what
 *      makes "everything below feeds the top" true rather than aspirational.
 *   2. No cycles, which invariant 1 already gives us, and which is checked anyway because
 *      layers can be edited by hand and a person dragging things is not a proof.
 */

import { LIMITS, type Loop, type LoopState, type TaskRecord, type Workspace } from "../types";

const loopsOf = (ws: Workspace): Readonly<Record<string, Loop>> => ws.loops ?? {};

export function listLoops(ws: Workspace): readonly Loop[] {
  return Object.values(loopsOf(ws)).sort(
    (a, b) => a.layer - b.layer || a.name.localeCompare(b.name),
  );
}

export function loopById(ws: Workspace, id: string): Loop | null {
  return loopsOf(ws)[id] ?? null;
}

/** Case and space insensitive, because a person and an agent name the same loop differently. */
export function findLoop(ws: Workspace, idOrName: string): Loop | null {
  const wanted = idOrName.trim().toLowerCase();
  if (wanted.length === 0) return null;
  const all = listLoops(ws);
  return (
    all.find((loop) => loop.id.toLowerCase() === wanted) ??
    all.find((loop) => loop.name.trim().toLowerCase() === wanted) ??
    null
  );
}

/** Ids are short and safe: they end up in patch keys and in a person's clipboard. */
export function loopId(name: string, now: () => number = Date.now): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const stamp = now().toString(36).slice(-4);
  return `${slug.length > 0 ? slug : "loop"}-${stamp}`;
}

export function clampLayer(layer: number): number {
  if (!Number.isFinite(layer)) return 0;
  return Math.min(Math.max(Math.floor(layer), 0), LIMITS.maxLoopLayers - 1);
}

/** The loops in each layer, floor first, so the renderer never has to sort again. */
export function layers(ws: Workspace): readonly (readonly Loop[])[] {
  const all = listLoops(ws);
  const depth = all.reduce((max, loop) => Math.max(max, loop.layer), 0);
  const out: Loop[][] = Array.from({ length: depth + 1 }, () => []);
  for (const loop of all) (out[clampLayer(loop.layer)] as Loop[]).push(loop);
  return out;
}

/** The loops feeding this one, which is what a person clicking it wants to see. */
export function feeders(ws: Workspace, id: string): readonly Loop[] {
  return listLoops(ws).filter((loop) => loop.feeds === id);
}

/** Every machine with a loop on it, in the order they first appear. */
export function hosts(ws: Workspace): readonly string[] {
  const seen: string[] = [];
  for (const loop of listLoops(ws)) {
    if (!seen.includes(loop.host)) seen.push(loop.host);
  }
  return seen;
}

/**
 * Why this loop may not feed that one, or null when it may.
 *
 * Named reasons, not a boolean: the agent and the person both get told what is wrong with
 * the arrangement they asked for, which is the only way either of them can fix it.
 */
export function feedRefusal(ws: Workspace, loop: Loop, target: string | undefined): string | null {
  if (target === undefined || target.length === 0) return null;
  if (target === loop.id) return `"${loop.name}" cannot feed itself.`;
  const to = loopById(ws, target);
  if (to === null) return `No loop with id ${target} on this board.`;
  if (to.layer <= loop.layer) {
    return `"${loop.name}" is in layer ${loop.layer} and "${to.name}" is in layer ${to.layer}. A loop feeds upward only, so put "${to.name}" in a higher layer first.`;
  }
  // Layers alone forbid cycles, but a hand-edited layer could still make one.
  const seen = new Set<string>([loop.id]);
  let cursor: Loop | null = to;
  while (cursor !== null) {
    if (seen.has(cursor.id)) return `That would make a ring: "${loop.name}" already feeds into "${cursor.name}".`;
    seen.add(cursor.id);
    cursor = cursor.feeds === undefined ? null : loopById(ws, cursor.feeds);
  }
  return null;
}

function withRoom(loops: Readonly<Record<string, Loop>>, id: string): Readonly<Record<string, Loop>> {
  if (Object.prototype.hasOwnProperty.call(loops, id)) return loops;
  const entries = Object.entries(loops);
  if (entries.length < LIMITS.maxLoops) return loops;
  const oldest = [...entries].sort((a, b) => a[1].updatedAt.localeCompare(b[1].updatedAt));
  const drop = new Set(oldest.slice(0, entries.length - LIMITS.maxLoops + 1).map(([key]) => key));
  return Object.fromEntries(entries.filter(([key]) => !drop.has(key)));
}

export function putLoop(ws: Workspace, loop: Loop): Workspace {
  const kept = withRoom(loopsOf(ws), loop.id);
  return { ...ws, loops: { ...kept, [loop.id]: loop } };
}

/**
 * A loop that goes away takes nothing with it: anything that fed it is left feeding
 * nobody rather than pointing at a hole the renderer would have to guess about.
 */
export function dropLoop(ws: Workspace, id: string): Workspace {
  const loops = loopsOf(ws);
  if (!Object.prototype.hasOwnProperty.call(loops, id)) return ws;
  const out: Record<string, Loop> = {};
  for (const [key, loop] of Object.entries(loops)) {
    if (key === id) continue;
    out[key] = loop.feeds === id ? { ...loop, feeds: undefined } : loop;
  }
  return { ...ws, loops: out };
}

export function loopRecord(text: string, by: string, at: string): TaskRecord {
  return {
    at,
    by,
    byKind: "agent",
    text: text.slice(0, LIMITS.maxTaskRecordChars),
  };
}

export function withRecord(loop: Loop, record: TaskRecord): Loop {
  const records = [...loop.records, record].slice(-LIMITS.maxTaskRecords);
  return { ...loop, records, updatedAt: record.at };
}

/** "running, last said: 4 offers under budget" for one line in the picture. */
export function loopLine(loop: Loop): string {
  const said = loop.lastSaid === undefined ? "" : `, last said: ${loop.lastSaid}`;
  const every = loop.every === undefined ? "" : ` ${loop.every}`;
  return `${loop.state}${every}${said}`;
}

export const LOOP_STATES: readonly LoopState[] = ["idle", "running", "held", "failed", "off"];
