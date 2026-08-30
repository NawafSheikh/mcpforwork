/**
 * The four loop tools: register one, report a tick, read the picture, move it.
 *
 * An agent registers the loops it runs on its own machine, and reports each tick. Nothing
 * here schedules anything: the loop runs where it already runs, and this is the shared
 * picture of it. That is the honest division, and it is why a loop on somebody else's
 * laptop and a loop on a VPS sit in the same drawing without either of us holding the
 * other's credentials.
 *
 * `rearrange_loop` is deliberately open to both a person and an agent: moving a box in a
 * picture is not a privileged act, and the refusals are about the shape being drawable,
 * never about who asked.
 */

import { z } from "zod";
import { LIMITS, type Loop, type LoopState, type Workspace } from "../types";
import {
  LOOP_STATES,
  clampLayer,
  feedRefusal,
  feeders,
  findLoop,
  hosts,
  layers,
  loopId,
  loopLine,
  loopRecord,
  putLoop,
  withRecord,
} from "./state";

export interface LoopHandlerResult {
  readonly next?: Workspace;
  readonly result: string;
}

export type LoopHandler = (input: unknown, ws: Workspace) => LoopHandlerResult;

export const LOOP_TOOL_NAMES = [
  "register_loop",
  "report_loop",
  "list_loops",
  "rearrange_loop",
] as const;
export type LoopToolName = (typeof LOOP_TOOL_NAMES)[number];

const callerSchema = z.string().min(1).max(LIMITS.maxCallerChars).optional();
const loopName = z.string().min(1).max(LIMITS.maxLoopNameChars);

/** caller becomes `from`, because a loop belongs to the agent that runs it. */
const loopTool = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, caller: callerSchema }).transform((value) => ({ ...value, from: value.caller }));

export const loopToolSchemas = {
  register_loop: loopTool({
    name: loopName,
    does: z.string().min(1).max(LIMITS.maxLoopDoesChars),
    every: z.string().max(60).optional(),
    layer: z.number().int().min(0).max(LIMITS.maxLoopLayers - 1).optional(),
    feeds: z.string().max(60).optional(),
    state: z.enum(["idle", "running", "held", "failed", "off"]).optional(),
  }),
  report_loop: loopTool({
    loop: loopName,
    state: z.enum(["idle", "running", "held", "failed", "off"]).optional(),
    said: z.string().max(LIMITS.maxTaskRecordChars).optional(),
  }),
  list_loops: loopTool({}),
  rearrange_loop: loopTool({
    loop: loopName,
    layer: z.number().int().min(0).max(LIMITS.maxLoopLayers - 1).optional(),
    feeds: z.string().max(60).optional(),
    why: z.string().max(LIMITS.maxTaskRecordChars).optional(),
  }),
} as const;

const stateSchema = {
  type: "string",
  enum: [...LOOP_STATES],
  description: "idle, running, held, failed or off. Where this loop is right now.",
};

export const loopJsonSchemas: Readonly<Record<LoopToolName, Record<string, unknown>>> = {
  register_loop: {
    type: "object",
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: LIMITS.maxLoopNameChars,
        description: "What this loop is called, as a person would say it: \"price scan\".",
      },
      does: {
        type: "string",
        minLength: 1,
        maxLength: LIMITS.maxLoopDoesChars,
        description: "What it actually does, in one line, in your own words.",
      },
      every: {
        type: "string",
        maxLength: 60,
        description: "\"every 10 minutes\", a cron string, or \"on demand\". Nothing here schedules it.",
      },
      layer: {
        type: "integer",
        minimum: 0,
        maximum: LIMITS.maxLoopLayers - 1,
        description: "0 is the floor. Loops feed upward, so raw work goes low and summaries go high.",
      },
      feeds: {
        type: "string",
        maxLength: 60,
        description: "Id or name of the loop this one feeds. It must be in a higher layer.",
      },
      state: stateSchema,
    },
    required: ["name", "does"],
    additionalProperties: false,
  },
  report_loop: {
    type: "object",
    properties: {
      loop: { type: "string", minLength: 1, maxLength: LIMITS.maxLoopNameChars, description: "Id or name from list_loops." },
      state: stateSchema,
      said: {
        type: "string",
        maxLength: LIMITS.maxTaskRecordChars,
        description: "One line on what this tick found or did. This is what the picture shows.",
      },
    },
    required: ["loop"],
    additionalProperties: false,
  },
  list_loops: { type: "object", properties: {}, additionalProperties: false },
  rearrange_loop: {
    type: "object",
    properties: {
      loop: { type: "string", minLength: 1, maxLength: LIMITS.maxLoopNameChars, description: "Id or name from list_loops." },
      layer: {
        type: "integer",
        minimum: 0,
        maximum: LIMITS.maxLoopLayers - 1,
        description: "The layer to move it to. 0 is the floor.",
      },
      feeds: {
        type: "string",
        maxLength: 60,
        description: "The loop it should feed now, in a higher layer. Empty string detaches it.",
      },
      why: { type: "string", maxLength: LIMITS.maxTaskRecordChars, description: "One line on why, kept on the loop." },
    },
    required: ["loop"],
    additionalProperties: false,
  },
};

export const LOOP_READ_ONLY_TOOLS: readonly LoopToolName[] = ["list_loops"];
/** Every line in the picture was typed by an agent, including other people's. */
export const LOOP_UNTRUSTED_TOOLS: readonly LoopToolName[] = ["list_loops"];

export const loopToolDescriptions: Readonly<Record<LoopToolName, string>> = {
  register_loop:
    "Put a loop you run on your own machine into the shared picture: what it is called, what it does, how often, which layer it sits in and which loop it feeds. Layer 0 is the floor and loops feed upward, so raw work goes low and the thing that reads it goes above. Nothing here schedules anything; your loop keeps running where it already runs, and this is how everybody else can see it.",
  report_loop:
    "Report a tick: the state this loop is in now and one line on what it found or did. This is what the picture shows, so say the thing a person would want to read at a glance (\"4 offers under budget\", \"build green\", \"nothing new\"), not that you ran.",
  list_loops:
    "Read the whole picture: every loop on this board, by layer from the floor up, with what it does, whose machine it runs on, what it feeds, its state and what it last said. Call it before registering anything so you extend the picture instead of drawing a second one beside it.",
  rearrange_loop:
    "Move a loop: put it in another layer, or point it at the loop it should feed. A loop feeds upward only, so a move that would go sideways, downward or in a ring is refused with the reason and nothing changes. A person can move it on the page too; this is the same operation.",
};

const field = (input: unknown, key: string): string | undefined => {
  const value = (input as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const rawField = (input: unknown, key: string): unknown =>
  (input as Record<string, unknown> | null)?.[key];

const num = (input: unknown, key: string): number | undefined => {
  const value = rawField(input, key);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const stateOf = (input: unknown): LoopState | undefined => {
  const value = rawField(input, "state");
  return typeof value === "string" && (LOOP_STATES as readonly string[]).includes(value)
    ? (value as LoopState)
    : undefined;
};

const AGENT_FALLBACK = "ChatGPT";
const callerOf = (input: unknown): string => field(input, "from") ?? AGENT_FALLBACK;

const register: LoopHandler = (input, ws) => {
  const name = field(input, "name");
  const does = field(input, "does");
  if (name === undefined || does === undefined) {
    return { result: "register_loop needs a name and a line saying what it does." };
  }
  const existing = findLoop(ws, name);
  const at = new Date().toISOString();
  const host = callerOf(input);
  const layer = clampLayer(num(input, "layer") ?? existing?.layer ?? 0);
  const every = field(input, "every") ?? existing?.every;

  const base: Loop = {
    id: existing?.id ?? loopId(name),
    name,
    does,
    layer,
    host,
    ...(every === undefined ? {} : { every }),
    state: stateOf(input) ?? existing?.state ?? "idle",
    records: existing?.records ?? [],
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
  };

  const wanted = field(input, "feeds");
  const target = wanted === undefined ? undefined : (findLoop(ws, wanted)?.id ?? wanted);
  const refusal = feedRefusal(ws, base, target);
  const loop: Loop = refusal === null && target !== undefined ? { ...base, feeds: target } : base;
  const next = putLoop(ws, loop);

  const feedsNote =
    refusal !== null
      ? ` It is not feeding anything yet: ${refusal}`
      : loop.feeds === undefined
        ? " It feeds nothing yet; call rearrange_loop once the loop above it exists."
        : ` It feeds "${findLoop(next, loop.feeds)?.name ?? loop.feeds}".`;

  return {
    next,
    result:
      `Loop "${loop.name}" (${loop.id}) is on the board in layer ${loop.layer}, running on ${loop.host}.${feedsNote} ` +
      "Call report_loop after each tick with one line a person would want to read.",
  };
};

const report: LoopHandler = (input, ws) => {
  const wanted = field(input, "loop");
  if (wanted === undefined) return { result: "report_loop needs a loop id or name." };
  const loop = findLoop(ws, wanted);
  if (loop === null) {
    return { result: `No loop called "${wanted}". Call list_loops, or register_loop to add it.` };
  }
  const at = new Date().toISOString();
  const said = field(input, "said");
  const state = stateOf(input) ?? loop.state;
  const moved: Loop = {
    ...loop,
    state,
    lastRunAt: at,
    ...(said === undefined ? {} : { lastSaid: said }),
    updatedAt: at,
  };
  const next = putLoop(
    ws,
    said === undefined ? moved : withRecord(moved, loopRecord(said, callerOf(input), at)),
  );
  return {
    next,
    result: `"${loop.name}" is ${state}${said === undefined ? "" : `: ${said}`}. Everybody on this board can see it.`,
  };
};

const list: LoopHandler = (_input, ws) => {
  const byLayer = layers(ws);
  if (byLayer.every((row) => row.length === 0)) {
    return {
      result:
        "No loops on this board yet. Call register_loop for each thing you keep running, with the layer it sits in: 0 is the floor and loops feed upward.",
    };
  }
  const rows = byLayer.map((row, layer) => ({
    layer,
    loops: row.map((loop) => ({
      id: loop.id,
      name: loop.name,
      does: loop.does,
      on: loop.host,
      feeds: loop.feeds ?? null,
      fedBy: feeders(ws, loop.id).map((item) => item.name),
      state: loop.state,
      every: loop.every ?? null,
      lastSaid: loop.lastSaid ?? null,
      lastRunAt: loop.lastRunAt ?? null,
    })),
  }));
  return { result: JSON.stringify({ layers: rows, machines: hosts(ws) }) };
};

const rearrange: LoopHandler = (input, ws) => {
  const wanted = field(input, "loop");
  if (wanted === undefined) return { result: "rearrange_loop needs a loop id or name." };
  const loop = findLoop(ws, wanted);
  if (loop === null) return { result: `No loop called "${wanted}". Call list_loops.` };

  const at = new Date().toISOString();
  const layer = num(input, "layer");
  const moved: Loop = {
    ...loop,
    ...(layer === undefined ? {} : { layer: clampLayer(layer) }),
    updatedAt: at,
  };

  const asked = rawField(input, "feeds");
  const detaching = typeof asked === "string" && asked.trim().length === 0;
  const wantedFeed = field(input, "feeds");
  const target =
    detaching ? undefined : wantedFeed === undefined ? moved.feeds : (findLoop(ws, wantedFeed)?.id ?? wantedFeed);

  const refusal = feedRefusal(ws, moved, target);
  if (refusal !== null) return { result: `Not moved. ${refusal}` };

  const settled: Loop = target === undefined ? { ...moved, feeds: undefined } : { ...moved, feeds: target };
  const why = field(input, "why");
  const withWhy =
    why === undefined ? settled : withRecord(settled, loopRecord(why, callerOf(input), at));
  const next = putLoop(ws, withWhy);

  const feedsName = settled.feeds === undefined ? "nothing" : `"${findLoop(next, settled.feeds)?.name ?? settled.feeds}"`;
  return {
    next,
    result: `"${settled.name}" is now in layer ${settled.layer}, feeding ${feedsName}. It is ${loopLine(settled)}.`,
  };
};

export const loopHandlers: Readonly<Record<LoopToolName, LoopHandler>> = {
  register_loop: register,
  report_loop: report,
  list_loops: list,
  rearrange_loop: rearrange,
};
