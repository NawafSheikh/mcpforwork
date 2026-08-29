/**
 * Feedback helpers: the notes humans and agents leave for each other.
 *
 * A note is attached to a FeedbackTarget. Four kinds name an object on the board (a
 * dashboard, the overview, a draft, a monitor) and three name somebody in the room: an
 * agent by its caller name, a person by their display name, or the room itself. That is
 * what makes the handover work in all four directions, person to person, person to agent,
 * agent to person and agent to agent, on one board that both sides are watching.
 * Everything here is pure: pass a Workspace in, get a new Workspace back, never mutate.
 * Both writes append an AuditEvent with tool "feedback" so the rail shows the exchange.
 */

import { LIMITS, type Actor, type Feedback, type FeedbackTarget, type Workspace } from "../types";
import { appendAudit, fnv1aHex, makeAuditEvent, truncate } from "../store/audit";

/** Tool name written on the audit events these helpers append. */
export const FEEDBACK_TOOL = "feedback";

/** Target id meaning "whoever picks this up first". */
export const ANY_ONE = "*";

/** The one target every room-wide request shares, so both sides read the same thread. */
export const ROOM_TARGET: FeedbackTarget = { kind: "room", id: "room" };

/** Target kinds that address somebody rather than an object on the board. */
export const ADDRESSED_KINDS: readonly FeedbackTarget["kind"][] = ["agent", "room", "person"];

export interface AddFeedbackInput {
  readonly target: FeedbackTarget;
  readonly text: string;
  readonly author: Actor;
  /** Caller name of the agent, or display name of the person, that wrote it. */
  readonly from?: string;
}

export interface ResolveFeedbackInput {
  readonly by: Actor;
  readonly resolution: string;
}

let sequence = 0;

function nextId(at: string, target: FeedbackTarget): string {
  sequence += 1;
  return `fb_${sequence.toString(36)}_${fnv1aHex(`${at}:${target.kind}:${target.id}:${sequence}`)}`;
}

export function sameTarget(a: FeedbackTarget, b: FeedbackTarget): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export function isOpen(item: Feedback): boolean {
  return item.resolvedAt === undefined;
}

/**
 * The sequence nextId baked into the id. A burst of notes from one tool call all carry
 * the same millisecond, and "newest first" has to mean something inside that burst.
 */
function sequenceOf(id: string): number {
  const parts = id.split("_");
  if (parts.length < 3 || parts[0] !== "fb") return Number.NaN;
  return Number.parseInt(parts[1] ?? "", 36);
}

const newestFirst = (a: Feedback, b: Feedback): number => {
  const byTime = b.createdAt.localeCompare(a.createdAt);
  if (byTime !== 0) return byTime;
  const left = sequenceOf(a.id);
  const right = sequenceOf(b.id);
  if (Number.isNaN(left) || Number.isNaN(right)) return b.id.localeCompare(a.id);
  return right - left;
};
const oldestFirst = (a: Feedback, b: Feedback): number => a.createdAt.localeCompare(b.createdAt);

/** Every note on the board, newest first, optionally narrowed to one target. */
export function listFeedback(ws: Workspace, target?: FeedbackTarget): readonly Feedback[] {
  const all = Object.values(ws.feedback ?? {});
  const scoped = target ? all.filter((item) => sameTarget(item.target, target)) : all;
  return [...scoped].sort(newestFirst);
}

/** Unresolved notes only, newest first. This is what the agent must read before editing. */
export function openFeedback(ws: Workspace, target?: FeedbackTarget): readonly Feedback[] {
  return listFeedback(ws, target).filter(isOpen);
}

export function resolvedFeedback(ws: Workspace, target?: FeedbackTarget): readonly Feedback[] {
  return listFeedback(ws, target).filter((item) => !isOpen(item));
}

export function openFeedbackCount(ws: Workspace, target?: FeedbackTarget): number {
  return openFeedback(ws, target).length;
}

/* ---------- addressing: notes left for a person, an agent or the whole room ---------- */

/**
 * The target in plain language. The four object kinds keep the "<kind> <id>" wording the
 * tools have always used; the three addressed kinds read like a sentence instead.
 */
export function describeTarget(target: FeedbackTarget): string {
  if (target.kind === "room") return "this room";
  if (target.kind === "agent") {
    return target.id === ANY_ONE ? "any agent in this room" : `agent ${target.id}`;
  }
  if (target.kind === "person") {
    return target.id === ANY_ONE ? "everyone in this room" : `person ${target.id}`;
  }
  return `${target.kind} ${target.id}`;
}

/** True when the note is work handed to an agent: named, "*", or the room at large. */
export function isAgentAddressed(item: Feedback): boolean {
  return item.target.kind === "agent" || item.target.kind === "room";
}

/** Who an agent-addressed note is waiting on, "*" when anybody may take it. */
export function addressedTo(item: Feedback): string | null {
  if (item.target.kind === "agent") return item.target.id;
  if (item.target.kind === "room") return ANY_ONE;
  return null;
}

/** True when a caller of this name should treat the note as its own to pick up. */
export function isFor(item: Feedback, name: string): boolean {
  const to = addressedTo(item);
  if (to === null) return false;
  return to === ANY_ONE || to.toLowerCase() === name.trim().toLowerCase();
}

/** Open notes handed to an agent rather than left on an object. */
export function agentAddressedCount(ws: Workspace): number {
  return openFeedback(ws).filter(isAgentAddressed).length;
}

/**
 * Open notes with the ones this caller was asked to do first, each half newest first.
 * A caller that does not name itself just gets the plain newest-first list.
 */
export function openFeedbackFor(ws: Workspace, caller?: string): readonly Feedback[] {
  const open = openFeedback(ws);
  const name = caller?.trim();
  if (name === undefined || name.length === 0) return open;
  const mine = open.filter((item) => isFor(item, name));
  if (mine.length === 0) return open;
  const mineIds = new Set(mine.map((item) => item.id));
  return [...mine, ...open.filter((item) => !mineIds.has(item.id))];
}

/** Every note addressed to somebody, so one thread can carry the whole conversation. */
export function addressedFeedback(ws: Workspace, includeResolved = false): readonly Feedback[] {
  const all = includeResolved ? listFeedback(ws) : openFeedback(ws);
  return all.filter((item) => ADDRESSED_KINDS.includes(item.target.kind));
}

/** " from Maria", or nothing at all when the writer did not say who they were. */
function byLine(item: Feedback): string {
  return item.from ? ` from ${item.from}` : "";
}

/**
 * Keep the board under LIMITS.maxFeedbackItems, dropping the oldest resolved notes
 * first so an unanswered question survives a busy day of resolved ones.
 */
function capItems(items: readonly Feedback[]): readonly Feedback[] {
  if (items.length <= LIMITS.maxFeedbackItems) return items;
  const ordered = [...items].sort(oldestFirst);
  const doomed = new Set<string>();
  const overflow = items.length - LIMITS.maxFeedbackItems;
  for (const item of ordered) {
    if (doomed.size >= overflow) break;
    if (!isOpen(item)) doomed.add(item.id);
  }
  for (const item of ordered) {
    if (doomed.size >= overflow) break;
    if (!doomed.has(item.id)) doomed.add(item.id);
  }
  return items.filter((item) => !doomed.has(item.id));
}

function indexById(items: readonly Feedback[]): Readonly<Record<string, Feedback>> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function withFeedback(ws: Workspace, items: readonly Feedback[]): Workspace {
  return { ...ws, feedback: indexById(capItems(items)) };
}

const preview = (text: string): string => truncate(text, 60);

/** Add one note. The text is capped, never rejected, so a long paste still lands. */
export function addFeedback(ws: Workspace, input: AddFeedbackInput): Workspace {
  const at = new Date().toISOString();
  const from = input.from?.trim();
  const item: Feedback = {
    id: nextId(at, input.target),
    target: input.target,
    text: truncate(input.text.trim(), LIMITS.maxFeedbackChars),
    author: input.author,
    ...(from ? { from: truncate(from, LIMITS.maxCallerChars) } : {}),
    createdAt: at,
  };
  const next = withFeedback(ws, [...Object.values(ws.feedback ?? {}), item]);
  const event = makeAuditEvent({
    actor: input.author,
    tool: FEEDBACK_TOOL,
    args: { target: input.target },
    result: `Note left on ${describeTarget(input.target)}: ${preview(item.text)}`,
    ok: true,
  });
  return appendAudit(next, event);
}

/** Mark one note resolved. Returns null when the id is unknown, so callers can say so. */
export function resolveFeedback(
  ws: Workspace,
  id: string,
  input: ResolveFeedbackInput,
): Workspace | null {
  const existing = ws.feedback?.[id];
  if (existing === undefined) return null;
  const at = new Date().toISOString();
  const item: Feedback = {
    ...existing,
    resolvedAt: existing.resolvedAt ?? at,
    resolvedBy: input.by,
    resolution: truncate(input.resolution.trim(), LIMITS.maxFeedbackChars),
  };
  const next: Workspace = { ...ws, feedback: { ...ws.feedback, [id]: item } };
  const event = makeAuditEvent({
    actor: input.by,
    tool: FEEDBACK_TOOL,
    args: { feedbackId: id, target: existing.target },
    result: `Resolved note on ${describeTarget(existing.target)}${byLine(existing)}: ${preview(item.resolution ?? "")}`,
    ok: true,
  });
  return appendAudit(next, event);
}
