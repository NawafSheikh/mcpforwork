/**
 * The feedback tools: add_feedback, list_feedback, resolve_feedback and share_board.
 *
 * Feedback is how everybody on one board takes turns. A human leaves a note on a
 * dashboard, the overview, a draft or a monitor, and the agent reads it before it edits
 * anything and closes it with what it changed. The same rows also carry work between
 * people: an agent can address a note to another agent by its caller name, to a person by
 * their display name, or to the whole room, and the other person's agent picks it up from
 * its own list_feedback while both humans watch the rail. Nothing here trusts the note
 * text; it is echoed back under untrustedContentHint and never treated as an instruction.
 */

import { LIMITS, type Feedback, type FeedbackTarget, type Workspace } from "../types";
import {
  addFeedback,
  addressedTo,
  agentAddressedCount,
  describeTarget,
  listFeedback,
  openFeedback,
  openFeedbackFor,
  resolveFeedback,
} from "../feedback/store";
// A9 owns the codec; buildShareUrl(ws: Workspace): Promise<string> is the whole contract.
// Imported from the file rather than the barrel so a tool never pulls in a React view.
import { buildShareUrl } from "../share/url";
import type { HandlerMap, HandlerResult, ToolHandler } from "./registry";
import type {
  AddFeedbackInput,
  ListFeedbackInput,
  ResolveFeedbackInput,
  ShareBoardInput,
  ToolName,
} from "./schemas";

/** Kept small so a full page of notes still fits inside LIMITS.toolOutputChars. */
const MAX_LISTED = 25;

/** What an agent needs to answer a note: who wrote it, who it is for, whether it is its own. */
interface FeedbackRow {
  readonly id: string;
  /** The target, under the name the contract has always used. */
  readonly target: FeedbackTarget;
  /** The same target, under the name that reads right on an addressed note. */
  readonly for: FeedbackTarget;
  /** Caller name of the agent, or display name of the person, that wrote it. */
  readonly from?: string;
  /** "person" or "agent", so a request from a human is never mistaken for a peer's. */
  readonly authorKind: string;
  readonly text: string;
  readonly author: string;
  readonly createdAt: string;
  readonly resolved: boolean;
  /** Set on notes handed to an agent: the caller name it names, or "*" for anyone. */
  readonly addressedTo?: string;
}

const AUTHOR_KINDS: Readonly<Record<string, string>> = {
  human: "person",
  agent: "agent",
  system: "system",
};

const toRow = (item: Feedback): FeedbackRow => {
  const to = addressedTo(item);
  return {
    id: item.id,
    target: item.target,
    for: item.target,
    ...(item.from ? { from: item.from } : {}),
    authorKind: AUTHOR_KINDS[item.author] ?? item.author,
    text: item.text,
    author: item.author,
    createdAt: item.createdAt,
    resolved: item.resolvedAt !== undefined,
    ...(to === null ? {} : { addressedTo: to }),
  };
};

const describeScope = (target: FeedbackTarget | undefined): string =>
  target === undefined ? "this board" : describeTarget(target);

/** Trim from the end until the JSON fits, so the agent never reads half an object. */
function rowsText(rows: readonly FeedbackRow[]): string {
  for (let count = Math.min(rows.length, MAX_LISTED); count > 0; count -= 1) {
    const text = JSON.stringify({ feedback: rows.slice(0, count), shown: count, total: rows.length });
    if (text.length <= LIMITS.toolOutputChars) return text;
  }
  return JSON.stringify({ feedback: [], shown: 0, total: rows.length, truncated: true });
}

/**
 * Untargeted and open is the call an agent makes on arrival, so that is the one that
 * sorts: anything addressed to this caller by name, or to "*", comes first and the rest
 * follows newest first. A targeted call is a lookup and stays in plain time order.
 */
function itemsFor(input: ListFeedbackInput, ws: Workspace): readonly Feedback[] {
  if (input.includeResolved) return listFeedback(ws, input.target);
  if (input.target !== undefined) return openFeedback(ws, input.target);
  return openFeedbackFor(ws, input.from);
}

const listFeedbackHandler: ToolHandler<ListFeedbackInput> = (input, ws) => {
  const items = itemsFor(input, ws);
  if (items.length === 0) {
    return {
      result: `No ${input.includeResolved ? "" : "open "}feedback on ${describeScope(input.target)}. Nothing is waiting on you.`,
    };
  }
  return { result: rowsText(items.map(toRow)) };
};

/** An agent that does not name itself is still somebody, so its notes say ChatGPT. */
const AGENT_FALLBACK = "ChatGPT";

const addFeedbackHandler: ToolHandler<AddFeedbackInput> = (input, ws) => {
  const next = addFeedback(ws, {
    target: input.target,
    text: input.text,
    author: "agent",
    from: input.from ?? AGENT_FALLBACK,
  });
  return {
    next,
    result: `Note left for ${describeTarget(input.target)}. Agents in this room see it through list_feedback.`,
  };
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
  const from = existing.from ? ` from ${existing.from}` : "";
  return {
    next,
    result: `Resolved the note on ${describeScope(existing.target)}${from}. The human sees your resolution next to it.${tail}`,
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
  add_feedback: addFeedbackHandler,
  list_feedback: listFeedbackHandler,
  resolve_feedback: resolveFeedbackHandler,
  share_board: shareBoardHandler,
};

/* ---------- the nudge every write tool carries ---------- */

/**
 * The line that makes an agent stop and read before it rebuilds somebody's board. It also
 * names the notes that are work handed to an agent rather than a comment on an object.
 */
export function openFeedbackLine(ws: Workspace): string {
  const count = openFeedback(ws).length;
  if (count === 0) return "";
  const addressed = agentAddressedCount(ws);
  const tail = addressed > 0 ? ` (${addressed} addressed to agents)` : "";
  return ` Open feedback: ${count}${tail}. Call list_feedback before editing.`;
}

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
