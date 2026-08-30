/**
 * What this workspace is for, and the toolset an agent argued for on that basis.
 *
 * Nawaf, 30 Aug: "once created makes ChatGPT ask what's this workspace for, user answers,
 * and ChatGPT finds all skills and MCPs to be made available for the purpose of this
 * workspace ... then on mcpforwork.com shows the list of tools ChatGPT selected".
 *
 * So the agent does not silently flip switches. It proposes, with one line per pack saying
 * why, and the page decides what that is worth:
 *
 *   - a pack that only reads or writes here is switched on, and the reason is kept beside
 *     it, because that is undoable and stays on the page;
 *   - a pack that can send, pay or move something is never switched on by a tool call. It
 *     is proposed, and a person turns it on. In a room that person is the host.
 *
 * The reason matters as much as the switch. An agent that turns six packs on without
 * saying why has told nobody anything, and the panel goes back to being a settings screen.
 */

import { z } from "zod";
import { inRoom, maySwitchPacks, switchBlockedReason } from "../packs/host";
import { BUILT_IN_PACKS, packById, packRiskLabel } from "../packs/registry";
import { packEnabled, setPackState } from "../packs/state";
import { LIMITS, type ToolChoice, type Workspace } from "../types";

export interface PurposeHandlerResult {
  readonly next?: Workspace;
  readonly result: string;
}

export type PurposeHandler = (input: unknown, ws: Workspace) => PurposeHandlerResult;

export const PURPOSE_TOOL_NAMES = ["set_purpose", "propose_tools"] as const;
export type PurposeToolName = (typeof PURPOSE_TOOL_NAMES)[number];

const callerSchema = z.string().min(1).max(LIMITS.maxCallerChars).optional();

const purposeTool = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, caller: callerSchema }).transform((value) => ({ ...value, from: value.caller }));

export const purposeToolSchemas = {
  set_purpose: purposeTool({ purpose: z.string().min(1).max(LIMITS.maxPurposeChars) }),
  propose_tools: purposeTool({
    on: z
      .array(
        z.object({
          pack: z.string().min(1).max(40),
          why: z.string().min(1).max(LIMITS.maxToolReasonChars),
        }),
      )
      .max(16)
      .optional(),
    off: z
      .array(
        z.object({
          pack: z.string().min(1).max(40),
          why: z.string().min(1).max(LIMITS.maxToolReasonChars),
        }),
      )
      .max(16)
      .optional(),
  }),
} as const;

const choice = {
  type: "array",
  maxItems: 16,
  items: {
    type: "object",
    properties: {
      pack: { type: "string", maxLength: 40, description: "The pack id from get_workspace." },
      why: {
        type: "string",
        maxLength: LIMITS.maxToolReasonChars,
        description: "One line a person will read, saying why this purpose needs it.",
      },
    },
    required: ["pack", "why"],
    additionalProperties: false,
  },
};

export const purposeJsonSchemas: Readonly<Record<PurposeToolName, Record<string, unknown>>> = {
  set_purpose: {
    type: "object",
    properties: {
      purpose: {
        type: "string",
        minLength: 1,
        maxLength: LIMITS.maxPurposeChars,
        description: "What this workspace is for, in the person's own words. Ask them first.",
      },
    },
    required: ["purpose"],
    additionalProperties: false,
  },
  propose_tools: {
    type: "object",
    properties: {
      on: { ...choice, description: "Packs this purpose needs, each with the reason." },
      off: { ...choice, description: "Packs it does not need, each with the reason." },
    },
    additionalProperties: false,
  },
};

export const PURPOSE_READ_ONLY_TOOLS: readonly PurposeToolName[] = [];
/** Both echo text somebody typed: the purpose, and the reasons on the cards. */
export const PURPOSE_UNTRUSTED_TOOLS: readonly PurposeToolName[] = ["set_purpose", "propose_tools"];

export const purposeToolDescriptions: Readonly<Record<PurposeToolName, string>> = {
  set_purpose:
    "Ask the person what this workspace is for, in one line, then record their answer here. Everybody who joins reads it, and it is what you argue from when you call propose_tools. Ask before you write: a purpose you invented for them is worse than none.",
  propose_tools:
    "Say which tool packs this purpose actually needs, and why, one line each. Packs that only read or write on this page are switched on and your reason is kept beside each one. Anything that can send, pay or move something is proposed and left for a person to turn on, so say why clearly. Call get_workspace first to see what packs exist and which are already on.",
};

const field = (input: unknown, key: string): string | undefined => {
  const value = (input as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const AGENT_FALLBACK = "ChatGPT";
const callerOf = (input: unknown): string => field(input, "from") ?? AGENT_FALLBACK;

interface Asked {
  readonly pack: string;
  readonly why: string;
}

function asked(input: unknown, key: "on" | "off"): readonly Asked[] {
  const raw = (input as Record<string, unknown> | null)?.[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const record = item as Record<string, unknown> | null;
      const pack = typeof record?.pack === "string" ? record.pack.trim() : "";
      const why = typeof record?.why === "string" ? record.why.trim() : "";
      return { pack, why };
    })
    .filter((item) => item.pack.length > 0 && item.why.length > 0);
}

/** A pack that can act outside this page is never turned on by a tool call. */
export function needsAPerson(packId: string): boolean {
  const pack = packById(packId);
  return pack !== null && (pack.risk === "send" || pack.risk === "move");
}

function withChoice(ws: Workspace, entry: ToolChoice): Workspace {
  return { ...ws, toolChoice: { ...(ws.toolChoice ?? {}), [entry.pack]: entry } };
}

export function listChoices(ws: Workspace): readonly ToolChoice[] {
  return Object.values(ws.toolChoice ?? {}).sort((a, b) => a.pack.localeCompare(b.pack));
}

const setPurpose: PurposeHandler = (input, ws) => {
  const purpose = field(input, "purpose");
  if (purpose === undefined) return { result: "set_purpose needs one line saying what this is for." };
  const trimmed = purpose.slice(0, LIMITS.maxPurposeChars);
  return {
    next: { ...ws, purpose: trimmed },
    result:
      `This workspace is for: ${trimmed}. Everybody who joins reads that. ` +
      "Now call propose_tools with the packs it needs and one line each saying why.",
  };
};

const proposeTools: PurposeHandler = (input, ws) => {
  const wantOn = asked(input, "on");
  const wantOff = asked(input, "off");
  if (wantOn.length === 0 && wantOff.length === 0) {
    const names = BUILT_IN_PACKS.map((pack) => `${pack.id} (${packRiskLabel(pack)})`).join(", ");
    return { result: `Nothing proposed. The packs on this page are: ${names}.` };
  }
  // In a room the switches are the host's, exactly as they are in the Tools panel.
  if (!maySwitchPacks()) return { result: switchBlockedReason() };

  const at = new Date().toISOString();
  const by = callerOf(input);
  const room = inRoom();
  const turnedOn: string[] = [];
  const heldBack: string[] = [];
  const turnedOff: string[] = [];
  const unknown: string[] = [];

  let next = ws;
  for (const item of [...wantOn, ...wantOff]) {
    const on = wantOn.includes(item);
    if (packById(item.pack) === null) {
      unknown.push(item.pack);
      continue;
    }
    const proposed = on && needsAPerson(item.pack);
    next = withChoice(next, {
      pack: item.pack,
      on,
      why: item.why.slice(0, LIMITS.maxToolReasonChars),
      by,
      ...(proposed ? { proposed: true } : {}),
      at,
    });
    if (proposed) {
      heldBack.push(`${item.pack} (${item.why})`);
      continue;
    }
    if (packEnabled(next, item.pack, room) !== on) {
      next = setPackState(next, { id: item.pack, enabled: on, by, at });
    }
    (on ? turnedOn : turnedOff).push(item.pack);
  }

  const parts: string[] = [];
  if (turnedOn.length > 0) parts.push(`On: ${turnedOn.join(", ")}.`);
  if (turnedOff.length > 0) parts.push(`Off: ${turnedOff.join(", ")}.`);
  if (heldBack.length > 0) {
    parts.push(
      `Waiting for a person, because these can act outside this page: ${heldBack.join("; ")}.`,
    );
  }
  if (unknown.length > 0) parts.push(`No pack called ${unknown.join(", ")} here.`);
  parts.push("Your reasons are on the page beside each switch, so a person can disagree with one.");
  return { next, result: parts.join(" ") };
};

export const purposeHandlers: Readonly<Record<PurposeToolName, PurposeHandler>> = {
  set_purpose: setPurpose,
  propose_tools: proposeTools,
};
