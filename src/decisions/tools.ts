/**
 * `decide` and `list_decisions`: what an agent considered, what it chose, and why.
 *
 * Nawaf, 30 Aug: "be able to visualize how the agents choose and why".
 *
 * The audit rail already says what happened. It cannot say why, and why is the only part
 * a person can actually argue with. So a decision is an object: the question, what was on
 * the table, which one was taken, and the reason, signed by whoever decided.
 *
 * Two things follow from that and are enforced here:
 *
 *   1. **What was chosen has to be something that was considered.** An agent that lists
 *      three options and then does a fourth thing has not made a decision, it has made a
 *      decision and a separate unexplained move, and the record would hide the second one.
 *   2. **A person disagreeing is not an edit.** The decision stands, with the objection
 *      recorded on it, because a trail somebody can quietly rewrite is not a trail.
 */

import { z } from "zod";
import { LIMITS, type Decision, type Workspace } from "../types";

export interface DecisionHandlerResult {
  readonly next?: Workspace;
  readonly result: string;
}

export type DecisionHandler = (input: unknown, ws: Workspace) => DecisionHandlerResult;

export const DECISION_TOOL_NAMES = ["decide", "list_decisions"] as const;
export type DecisionToolName = (typeof DECISION_TOOL_NAMES)[number];

const callerSchema = z.string().min(1).max(LIMITS.maxCallerChars).optional();
const line = z.string().min(1).max(LIMITS.maxDecisionChars);

const decisionTool = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, caller: callerSchema }).transform((value) => ({ ...value, from: value.caller }));

export const decisionToolSchemas = {
  decide: decisionTool({
    what: line,
    considered: z.array(line).min(1).max(LIMITS.maxConsidered),
    chose: line,
    because: line,
  }),
  list_decisions: decisionTool({}),
} as const;

export const decisionJsonSchemas: Readonly<Record<DecisionToolName, Record<string, unknown>>> = {
  decide: {
    type: "object",
    properties: {
      what: {
        type: "string",
        minLength: 1,
        maxLength: LIMITS.maxDecisionChars,
        description: "The question you were actually answering, in one line.",
      },
      considered: {
        type: "array",
        minItems: 1,
        maxItems: LIMITS.maxConsidered,
        items: { type: "string", minLength: 1, maxLength: LIMITS.maxDecisionChars },
        description: "Everything that was on the table, including the one you took.",
      },
      chose: {
        type: "string",
        minLength: 1,
        maxLength: LIMITS.maxDecisionChars,
        description: "The one you took. It must be one of the options you considered.",
      },
      because: {
        type: "string",
        minLength: 1,
        maxLength: LIMITS.maxDecisionChars,
        description: "Why that one and not the others. This is the part a person argues with.",
      },
    },
    required: ["what", "considered", "chose", "because"],
    additionalProperties: false,
  },
  list_decisions: { type: "object", properties: {}, additionalProperties: false },
};

export const DECISION_READ_ONLY_TOOLS: readonly DecisionToolName[] = ["list_decisions"];
/** Every word of a decision was written by an agent, including other people's. */
export const DECISION_UNTRUSTED_TOOLS: readonly DecisionToolName[] = ["list_decisions"];

export const decisionToolDescriptions: Readonly<Record<DecisionToolName, string>> = {
  decide:
    "Write down a choice you just made, so a person can disagree with the reasoning rather than only with the result: the question, everything you considered, the one you took and why. Use it when a choice was not obvious, when you ruled something out, or when you picked between two ways of doing what you were asked. What you chose has to be one of the options you listed.",
  list_decisions:
    "Read the choices already made on this board, newest first, with what was considered each time and any objection a person left. Call it before deciding something similar so you extend the reasoning instead of quietly contradicting it.",
};

const field = (input: unknown, key: string): string | undefined => {
  const value = (input as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const AGENT_FALLBACK = "ChatGPT";
const callerOf = (input: unknown): string => field(input, "from") ?? AGENT_FALLBACK;

function options(input: unknown): readonly string[] {
  const raw = (input as Record<string, unknown> | null)?.considered;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, LIMITS.maxDecisionChars))
    .filter((item) => item.length > 0)
    .slice(0, LIMITS.maxConsidered);
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

export function listDecisions(ws: Workspace): readonly Decision[] {
  return Object.values(ws.decisions ?? {}).sort((a, b) => b.at.localeCompare(a.at));
}

export function decisionId(at: string, what: string): string {
  const slug = what
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `d-${slug || "choice"}-${at.slice(11, 19).replace(/:/g, "")}`;
}

/** Drop the oldest once the board is full, so a long session cannot grow without bound. */
function withRoom(all: Readonly<Record<string, Decision>>, id: string): Record<string, Decision> {
  const entries = Object.entries(all);
  if (Object.prototype.hasOwnProperty.call(all, id) || entries.length < LIMITS.maxDecisions) {
    return Object.fromEntries(entries);
  }
  const oldest = [...entries].sort((a, b) => a[1].at.localeCompare(b[1].at));
  const drop = new Set(oldest.slice(0, entries.length - LIMITS.maxDecisions + 1).map(([key]) => key));
  return Object.fromEntries(entries.filter(([key]) => !drop.has(key)));
}

const decide: DecisionHandler = (input, ws) => {
  const what = field(input, "what");
  const chose = field(input, "chose");
  const because = field(input, "because");
  const considered = options(input);

  if (what === undefined || chose === undefined || because === undefined) {
    return { result: "decide needs what you were deciding, what you chose, and why." };
  }
  if (considered.length === 0) {
    return { result: "decide needs the options you considered. One of them has to be the one you took." };
  }
  if (!considered.some((option) => same(option, chose))) {
    return {
      result:
        `You chose "${chose}", which is not one of the options you listed (${considered.join(", ")}). ` +
        "Either add it to considered, or say what you actually picked from that list. A choice that was never an option is two moves, and the second one would go unrecorded.",
    };
  }

  const at = new Date().toISOString();
  const decision: Decision = {
    id: decisionId(at, what),
    what,
    considered,
    chose,
    because,
    by: callerOf(input),
    at,
  };
  const kept = withRoom(ws.decisions ?? {}, decision.id);
  return {
    next: { ...ws, decisions: { ...kept, [decision.id]: decision } },
    result:
      `Written down: ${what} - you took "${chose}" because ${because}. ` +
      `${considered.length - 1} other option${considered.length === 2 ? "" : "s"} recorded. ` +
      "Anybody here can now disagree with the reason rather than only with the result.",
  };
};

const list: DecisionHandler = (_input, ws) => {
  const all = listDecisions(ws);
  if (all.length === 0) {
    return {
      result:
        "No decisions written down yet. Call decide when a choice was not obvious, so the next person or agent can see why rather than guessing from what happened.",
    };
  }
  const rows = all.slice(0, 20).map((item) => ({
    what: item.what,
    chose: item.chose,
    because: item.because,
    instead: item.considered.filter((option) => !same(option, item.chose)),
    by: item.by,
    at: item.at,
    ...(item.disagreed === undefined ? {} : { disagreed: item.disagreed }),
  }));
  return { result: JSON.stringify({ decisions: rows, total: all.length }) };
};

export const decisionHandlers: Readonly<Record<DecisionToolName, DecisionHandler>> = {
  decide,
  list_decisions: list,
};

/**
 * A person saying a decision was wrong. It never edits the decision: the objection is
 * recorded beside it, because a trail somebody can quietly rewrite is not a trail.
 */
export function disagree(ws: Workspace, id: string, by: string, said: string): Workspace {
  const decision = (ws.decisions ?? {})[id];
  if (decision === undefined) return ws;
  const next: Decision = {
    ...decision,
    disagreed: { by, said: said.slice(0, LIMITS.maxDecisionChars), at: new Date().toISOString() },
  };
  return { ...ws, decisions: { ...(ws.decisions ?? {}), [id]: next } };
}
