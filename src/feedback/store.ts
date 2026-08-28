/**
 * Feedback helpers: the notes humans and agents leave on the same objects.
 *
 * A note is attached to a FeedbackTarget (a dashboard, the overview, a draft or a
 * monitor) so both sides can take turns on one board without talking past each other.
 * Everything here is pure: pass a Workspace in, get a new Workspace back, never mutate.
 * Both writes append an AuditEvent with tool "feedback" so the rail shows the exchange.
 */

import { LIMITS, type Actor, type Feedback, type FeedbackTarget, type Workspace } from "../types";
import { appendAudit, fnv1aHex, makeAuditEvent, truncate } from "../store/audit";

/** Tool name written on the audit events these helpers append. */
export const FEEDBACK_TOOL = "feedback";

export interface AddFeedbackInput {
  readonly target: FeedbackTarget;
  readonly text: string;
  readonly author: Actor;
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

const newestFirst = (a: Feedback, b: Feedback): number => b.createdAt.localeCompare(a.createdAt);
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
  const item: Feedback = {
    id: nextId(at, input.target),
    target: input.target,
    text: truncate(input.text.trim(), LIMITS.maxFeedbackChars),
    author: input.author,
    createdAt: at,
  };
  const next = withFeedback(ws, [...Object.values(ws.feedback ?? {}), item]);
  const event = makeAuditEvent({
    actor: input.author,
    tool: FEEDBACK_TOOL,
    args: { target: input.target },
    result: `Note left on ${input.target.kind} ${input.target.id}: ${preview(item.text)}`,
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
    result: `Resolved note on ${existing.target.kind} ${existing.target.id}: ${preview(item.resolution ?? "")}`,
    ok: true,
  });
  return appendAudit(next, event);
}
