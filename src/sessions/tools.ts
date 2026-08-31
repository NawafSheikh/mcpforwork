/**
 * `attach_sessions`, `list_attached`, `place_session`, `did_outside_loop`.
 *
 * Nawaf, 31 Aug: "once the user selects them, ChatGPT goes through them; if any can be
 * converted, or are loops, place them appropriately... now if the user says build me a
 * PowerPoint presentation, that doesn't go in any loops, ChatGPT does it outside the loop."
 *
 * Four tools, and the rules between them are the feature:
 *
 *   1. **A session must be ruled on.** `place_session` demands a verdict and a reason.
 *      There is no way to half-place one, and `list_attached` keeps handing back the ones
 *      still waiting, so an agent that skips a session is told about it every time.
 *   2. **A one-off is a verdict, not an omission.** Deciding a session is not a loop is a
 *      recorded act with a reason on it. Otherwise "I looked and it is not a loop" and "I
 *      did not look" are the same empty board.
 *   3. **The live session is the top, and it is not attachable.** The agent driving this
 *      page is already the highest layer by construction: everything attached runs
 *      somewhere else and feeds up toward the conversation the person is actually in.
 *      Attaching it would put the room inside the room.
 *   4. **Nothing here can start or stop a session.** The bridge lists; the board records.
 *      Neither has a tool that touches the process, deliberately.
 */

import { z } from "zod";
import {
  LIMITS,
  type AttachedSession,
  type Loop,
  type OutsideWork,
  type SessionKind,
  type Workspace,
} from "../types";
import { clampLayer, feedRefusal, findLoop, listLoops, loopId, putLoop } from "../loops/state";
import { attach, listOutside, listSessions, noteOutside, place, sessionById, unplaced } from "./state";

export interface SessionHandlerResult {
  readonly next?: Workspace;
  readonly result: string;
}

export type SessionHandler = (input: unknown, ws: Workspace) => SessionHandlerResult;

export const SESSION_TOOL_NAMES = [
  "attach_sessions",
  "list_attached",
  "place_session",
  "did_outside_loop",
] as const;
export type SessionToolName = (typeof SESSION_TOOL_NAMES)[number];

const KINDS: readonly SessionKind[] = ["chatgpt-desktop", "codex", "claude-code", "terminal"];

const callerSchema = z.string().min(1).max(LIMITS.maxCallerChars).optional();
const line = z.string().min(1).max(LIMITS.maxTaskRecordChars);

const sessionTool = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({ ...shape, caller: callerSchema })
    .transform((value) => ({ ...value, from: value.caller }));

export const sessionToolSchemas = {
  attach_sessions: sessionTool({
    sessions: z
      .array(
        z.object({
          id: z.string().min(1).max(60),
          kind: z.enum(["chatgpt-desktop", "codex", "claude-code", "terminal"]),
          what: z.string().min(1).max(LIMITS.maxSessionWhatChars),
          where: z.string().max(90).optional(),
        }),
      )
      .min(1)
      .max(LIMITS.maxSessions),
  }),
  list_attached: sessionTool({}),
  place_session: sessionTool({
    session: z.string().min(1).max(60),
    as: z.enum(["loop", "one-off"]),
    why: line,
    name: z.string().max(LIMITS.maxLoopNameChars).optional(),
    does: z.string().max(LIMITS.maxLoopDoesChars).optional(),
    layer: z.number().int().min(0).max(LIMITS.maxLoopLayers - 1).optional(),
    feeds: z.string().max(60).optional(),
    every: z.string().max(60).optional(),
  }),
  did_outside_loop: sessionTool({ what: line, why: line }),
} as const;

export const sessionJsonSchemas: Readonly<Record<SessionToolName, Record<string, unknown>>> = {
  attach_sessions: {
    type: "object",
    properties: {
      sessions: {
        type: "array",
        minItems: 1,
        maxItems: LIMITS.maxSessions,
        description: "The sessions the person picked, straight from list_sessions.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "The id list_sessions gave it." },
            kind: { type: "string", enum: [...KINDS] },
            what: { type: "string", maxLength: LIMITS.maxSessionWhatChars },
            where: { type: "string", maxLength: 90, description: "The project, if known." },
          },
          required: ["id", "kind", "what"],
          additionalProperties: false,
        },
      },
    },
    required: ["sessions"],
    additionalProperties: false,
  },
  list_attached: { type: "object", properties: {}, additionalProperties: false },
  place_session: {
    type: "object",
    properties: {
      session: { type: "string", description: "The attached session's id." },
      as: {
        type: "string",
        enum: ["loop", "one-off"],
        description:
          "loop if it keeps running and produces something others depend on; one-off if it is a task somebody is finishing right now.",
      },
      why: {
        type: "string",
        maxLength: LIMITS.maxTaskRecordChars,
        description: "Why it is that and not the other. A person reads this and can argue with it.",
      },
      name: { type: "string", maxLength: LIMITS.maxLoopNameChars, description: "With as=loop: what to call it." },
      does: { type: "string", maxLength: LIMITS.maxLoopDoesChars, description: "With as=loop: what it does, one line." },
      layer: {
        type: "integer",
        minimum: 0,
        maximum: LIMITS.maxLoopLayers - 1,
        description: "With as=loop: 0 is the floor. Raw work low, summaries high.",
      },
      feeds: { type: "string", description: "With as=loop: the loop above that this one feeds." },
      every: { type: "string", maxLength: 60, description: "With as=loop: how often, in words." },
    },
    required: ["session", "as", "why"],
    additionalProperties: false,
  },
  did_outside_loop: {
    type: "object",
    properties: {
      what: { type: "string", maxLength: LIMITS.maxTaskRecordChars, description: "What you did." },
      why: {
        type: "string",
        maxLength: LIMITS.maxTaskRecordChars,
        description: "Why it is not a loop. Usually: it was asked for once and is now finished.",
      },
    },
    required: ["what", "why"],
    additionalProperties: false,
  },
};

export const SESSION_READ_ONLY_TOOLS: readonly SessionToolName[] = ["list_attached"];
/** Every word came off somebody's command line or out of another agent. */
export const SESSION_UNTRUSTED_TOOLS: readonly SessionToolName[] = ["list_attached"];

export const sessionToolDescriptions: Readonly<Record<SessionToolName, string>> = {
  attach_sessions:
    "Put the sessions a person picked on this board, from what list_sessions found on their machine. Attaching only records them; you still have to rule on each one with place_session. Do not attach the session you are in: you are the top of this board already.",
  list_attached:
    "The sessions attached to this board and what you decided about each, with the ones still waiting on a verdict listed first. Call it after attaching, and again whenever you are unsure what is left to do.",
  place_session:
    "Rule on one attached session: is it a loop, or a one-off. A loop keeps running and other work depends on what it produces, so it goes on the board in a layer. A one-off is a task somebody is finishing now, and it stays off the loops with your reason recorded beside it. Either way you have to say why.",
  did_outside_loop:
    "Record work you did that is deliberately not a loop: a slide deck, a one-time script, an answer to a question. It keeps the loops picture honest by showing what happened without pretending it recurs. Use it whenever somebody asks for a thing rather than a habit.",
};

/* ---------------------------------------------------------------- handlers */

const field = (input: unknown, key: string): string | undefined => {
  const value = (input as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const AGENT_FALLBACK = "ChatGPT";
const callerOf = (input: unknown): string => field(input, "from") ?? AGENT_FALLBACK;

function incoming(input: unknown, host: string, at: string): readonly AttachedSession[] {
  const raw = (input as Record<string, unknown> | null)?.sessions;
  if (!Array.isArray(raw)) return [];
  const out: AttachedSession[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id.trim().slice(0, 60) : "";
    const kind = KINDS.find((known) => known === rec.kind);
    const what = typeof rec.what === "string" ? rec.what.trim().slice(0, LIMITS.maxSessionWhatChars) : "";
    if (id.length === 0 || kind === undefined || what.length === 0) continue;
    const where = typeof rec.where === "string" && rec.where.trim().length > 0 ? rec.where.trim().slice(0, 90) : undefined;
    out.push({
      id,
      kind,
      what,
      ...(where === undefined ? {} : { where }),
      host,
      attachedAt: at,
      placement: "unplaced",
    });
  }
  return out;
}

const KIND_WORDS: Readonly<Record<SessionKind, string>> = {
  "chatgpt-desktop": "ChatGPT desktop",
  codex: "Codex",
  "claude-code": "Claude Code",
  terminal: "a terminal",
};

const attachHandler: SessionHandler = (input, ws) => {
  const at = new Date().toISOString();
  const found = incoming(input, callerOf(input), at);
  if (found.length === 0) {
    return {
      result:
        "attach_sessions needs the sessions themselves, each with an id, a kind and what it is. Call list_sessions on the local bridge first and pass through the ones the person picked.",
    };
  }
  const next = attach(ws, found);
  const waiting = unplaced(next).length;
  return {
    next,
    result:
      `Attached ${found.length} session${found.length === 1 ? "" : "s"} from ${callerOf(input)}'s machine: ` +
      `${found.map((session) => `${KIND_WORDS[session.kind]}${session.where === undefined ? "" : ` in ${session.where}`}`).join(", ")}. ` +
      `${waiting} now waiting on a verdict. Call place_session on each one: a loop goes on the board in a layer, a one-off stays off it with your reason.`,
  };
};

const listHandler: SessionHandler = (_input, ws) => {
  const all = listSessions(ws);
  if (all.length === 0) {
    return {
      result:
        "Nothing attached to this board yet. If a local bridge is on, call list_sessions to see what is running on this machine, then attach_sessions with the ones the person picked.",
    };
  }
  const row = (session: AttachedSession) => ({
    id: session.id,
    kind: session.kind,
    what: session.what,
    ...(session.where === undefined ? {} : { where: session.where }),
    host: session.host,
    placement: session.placement,
    ...(session.why === undefined ? {} : { why: session.why }),
    ...(session.loop === undefined ? {} : { loop: session.loop }),
  });
  const waiting = all.filter((session) => session.placement === "unplaced");
  return {
    result: JSON.stringify({
      waiting: waiting.map(row),
      placed: all.filter((session) => session.placement !== "unplaced").map(row),
      outside: listOutside(ws).map((item) => ({ what: item.what, why: item.why, by: item.by })),
      note:
        waiting.length === 0
          ? "Every attached session has a verdict."
          : `${waiting.length} still waiting. place_session takes a verdict and a reason for each.`,
    }),
  };
};

/** A session becoming a loop reuses the loops rules exactly, refusals included. */
function asLoop(
  ws: Workspace,
  session: AttachedSession,
  input: unknown,
  by: string,
  at: string,
): SessionHandlerResult {
  const name = field(input, "name") ?? `${KIND_WORDS[session.kind]}${session.where === undefined ? "" : ` in ${session.where}`}`;
  const does = field(input, "does") ?? session.what;
  const rawLayer = (input as Record<string, unknown> | null)?.layer;
  const layer = clampLayer(typeof rawLayer === "number" ? rawLayer : 0);
  const feeds = field(input, "feeds");
  const every = field(input, "every");
  const why = field(input, "why") ?? "";

  const id = loopId(name);
  const loop: Loop = {
    id,
    name: name.slice(0, LIMITS.maxLoopNameChars),
    does: does.slice(0, LIMITS.maxLoopDoesChars),
    layer,
    host: session.host,
    ...(every === undefined ? {} : { every }),
    state: "running",
    records: [],
    createdAt: at,
    updatedAt: at,
  };

  // The feed rules live in one place. A session arriving through this door obeys the same
  // ones a loop registered by hand does, refusal wording included.
  if (feeds !== undefined) {
    const target = findLoop(ws, feeds);
    const refusal =
      target === null
        ? `There is no loop called "${feeds}" to feed. Place it without feeds, or name one that is on the board.`
        : feedRefusal(ws, loop, target.id);
    if (refusal !== null) return { result: refusal };
    const withFeed: Loop = { ...loop, feeds: target === null ? undefined : target.id };
    const next = place(putLoop(ws, withFeed), session.id, "loop", why, id);
    return {
      next,
      result:
        `${KIND_WORDS[session.kind]} is now the loop "${loop.name}" in layer ${layer}, feeding "${target?.name ?? feeds}", on ${session.host}. ` +
        `Because: ${why}`,
    };
  }

  const next = place(putLoop(ws, loop), session.id, "loop", why, id);
  return {
    next,
    result:
      `${KIND_WORDS[session.kind]} is now the loop "${loop.name}" in layer ${layer} on ${session.host}, feeding nothing yet. ` +
      `Because: ${why} Use rearrange_loop to point it at what it feeds.`,
  };
}

const placeHandler: SessionHandler = (input, ws) => {
  const id = field(input, "session");
  const as = field(input, "as");
  const why = field(input, "why");
  if (id === undefined || as === undefined || why === undefined) {
    return { result: "place_session needs the session, whether it is a loop or a one-off, and why." };
  }
  const session = sessionById(ws, id);
  if (session === null) {
    const known = listSessions(ws).map((item) => item.id);
    return {
      result:
        `No session called "${id}" is attached here. ` +
        (known.length === 0
          ? "Nothing is attached yet; call attach_sessions first."
          : `Attached: ${known.join(", ")}.`),
    };
  }
  const at = new Date().toISOString();
  const by = callerOf(input);
  if (as === "loop") return asLoop(ws, session, input, by, at);

  return {
    next: place(ws, id, "one-off", why),
    result:
      `${KIND_WORDS[session.kind]}${session.where === undefined ? "" : ` in ${session.where}`} is not a loop, and the board says so rather than leaving it out: ${why} ` +
      "It stays attached so the next person can see it was looked at.",
  };
};

const outsideHandler: SessionHandler = (input, ws) => {
  const what = field(input, "what");
  const why = field(input, "why");
  if (what === undefined || why === undefined) {
    return { result: "did_outside_loop needs what you did and why it is not a loop." };
  }
  const at = new Date().toISOString();
  const item: OutsideWork = {
    id: `out-${at.slice(11, 19).replace(/:/g, "")}-${what.length}`,
    what,
    by: callerOf(input),
    why,
    at,
  };
  return {
    next: noteOutside(ws, item),
    result:
      `Recorded outside the loops: ${what}. Not a loop because ${why} ` +
      `The board is still ${listLoops(ws).length} loop${listLoops(ws).length === 1 ? "" : "s"}, which is the point.`,
  };
};

export const sessionHandlers: Readonly<Record<SessionToolName, SessionHandler>> = {
  attach_sessions: attachHandler,
  list_attached: listHandler,
  place_session: placeHandler,
  did_outside_loop: outsideHandler,
};
