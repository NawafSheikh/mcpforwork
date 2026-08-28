/**
 * The three wave 2 tools: list_feedback, resolve_feedback and share_board.
 *
 * Feedback is how a human and an agent take turns on the same board: the human leaves a
 * note on a dashboard, the overview, a draft or a monitor, the agent reads it before it
 * edits anything and closes it with what it changed. Nothing here trusts the note text;
 * it is echoed back under untrustedContentHint and never treated as an instruction.
 */

import { LIMITS, type Feedback, type FeedbackTarget, type Workspace } from "../types";
import { openFeedback, listFeedback, resolveFeedback } from "../feedback/store";
// A9 owns the codec; buildShareUrl(ws: Workspace): Promise<string> is the whole contract.
// Imported from the file rather than the barrel so a tool never pulls in a React view.
import { buildShareUrl } from "../share/url";
import type { HandlerMap, HandlerResult, ToolHandler } from "./registry";
import type { ListFeedbackInput, ResolveFeedbackInput, ShareBoardInput, ToolName } from "./schemas";

/** Kept small so a full page of notes still fits inside LIMITS.toolOutputChars. */
const MAX_LISTED = 25;

interface FeedbackRow {
  readonly id: string;
  readonly target: FeedbackTarget;
  readonly text: string;
  readonly author: string;
  readonly createdAt: string;
  readonly resolved: boolean;
}

const toRow = (item: Feedback): FeedbackRow => ({
  id: item.id,
  target: item.target,
  text: item.text,
  author: item.author,
  createdAt: item.createdAt,
  resolved: item.resolvedAt !== undefined,
});

const describeTarget = (target: FeedbackTarget | undefined): string =>
  target === undefined ? "this board" : `${target.kind} ${target.id}`;

/** Trim from the end until the JSON fits, so the agent never reads half an object. */
function rowsText(rows: readonly FeedbackRow[]): string {
  for (let count = Math.min(rows.length, MAX_LISTED); count > 0; count -= 1) {
    const text = JSON.stringify({ feedback: rows.slice(0, count), shown: count, total: rows.length });
    if (text.length <= LIMITS.toolOutputChars) return text;
  }
  return JSON.stringify({ feedback: [], shown: 0, total: rows.length, truncated: true });
}

const listFeedbackHandler: ToolHandler<ListFeedbackInput> = (input, ws) => {
  const items = input.includeResolved
    ? listFeedback(ws, input.target)
    : openFeedback(ws, input.target);
  if (items.length === 0) {
    return {
      result: `No ${input.includeResolved ? "" : "open "}feedback on ${describeTarget(input.target)}. Nothing is waiting on you.`,
    };
  }
  return { result: rowsText(items.map(toRow)) };
};

const unknownIdText = (id: string): string =>
  `No feedback with id "${id}". Call list_feedback to see the open notes and their ids; the workspace is unchanged.`;

const resolveFeedbackHandler: ToolHandler<ResolveFeedbackInput> = (input, ws) => {
  const existing = ws.feedback?.[input.feedbackId];
  if (existing === undefined) return { result: unknownIdText(input.feedbackId) };
  const next = resolveFeedback(ws, input.feedbackId, { by: "agent", resolution: input.resolution });
  if (next === null) return { result: unknownIdText(input.feedbackId) };
  const left = openFeedback(next, existing.target).length;
  const tail = left > 0 ? ` ${left} note(s) still open on that target.` : "";
  return {
    next,
    result: `Resolved the note on ${describeTarget(existing.target)}. The human sees your resolution next to it.${tail}`,
  };
};

const SHARE_PREFIX = "Read-only snapshot link, nothing was uploaded: ";

/** A link too long to return is not an error the agent can fix, so it is named plainly. */
const tooLongText = (chars: number): string =>
  `This board makes a ${chars} character link, which is longer than one tool reply can carry. The human can still copy it with the Share button on the page.`;

const shareBoardHandler: ToolHandler<ShareBoardInput> = async (_input, ws) => {
  try {
    const url = await buildShareUrl(ws);
    if (SHARE_PREFIX.length + url.length > LIMITS.toolOutputChars) {
      return { result: tooLongText(url.length) };
    }
    return { result: `${SHARE_PREFIX}${url}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { result: `share_board could not build a link: ${message}` };
  }
};

export const feedbackHandlers: HandlerMap = {
  list_feedback: listFeedbackHandler,
  resolve_feedback: resolveFeedbackHandler,
  share_board: shareBoardHandler,
};

/* ---------- the nudge every write tool carries ---------- */

export const FEEDBACK_NOTICE = "There is open feedback on this target; call list_feedback.";

/** Which object a write tool touched, so the reply can name unread notes on it. */
export function noticeTarget(name: ToolName, input: unknown): FeedbackTarget | null {
  const record = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const id = (key: string): string | null =>
    typeof record[key] === "string" && record[key] !== "" ? (record[key] as string) : null;
  if (name === "upsert_dashboard") {
    const category = id("category");
    return category === null ? null : { kind: "dashboard", id: category };
  }
  if (name === "compose_overview") return { kind: "overview", id: "overview" };
  if (name === "set_policy") {
    const monitorId = id("monitorId");
    return monitorId === null ? null : { kind: "monitor", id: monitorId };
  }
  return null;
}

/** Append the nudge when the object the tool just wrote still has an unread note. */
export function withFeedbackNotice(
  name: ToolName,
  input: unknown,
  ws: Workspace,
  outcome: HandlerResult,
): HandlerResult {
  const target = noticeTarget(name, input);
  if (target === null) return outcome;
  if (openFeedback(ws, target).length === 0) return outcome;
  if (outcome.result.includes(FEEDBACK_NOTICE)) return outcome;
  return { ...outcome, result: `${outcome.result} ${FEEDBACK_NOTICE}` };
}
