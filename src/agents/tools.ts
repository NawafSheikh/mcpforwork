/**
 * `join_as`: an agent's first call in a room.
 *
 * It claims a name, publishes the card that makes the name visible to everyone, and hands
 * back the exact string to pass as `caller` from then on. It belongs to the `rooms` pack,
 * because it is about who is here, and it grants nothing: a name is a label, not a key.
 */

import { z } from "zod";
import { capabilityKey } from "../capabilities/coerce";
import { listCapabilities, publishCapability } from "../capabilities/state";
import { enabledPackIds } from "../packs/state";
import { inRoom } from "../packs/host";
import { LIMITS, type Capability, type Workspace } from "../types";
import { agentNames, grantName, heldName, isBareVendorName, setHeldName } from "./identity";

export interface AgentHandlerResult {
  readonly next?: Workspace;
  readonly result: string;
}

export type AgentHandler = (input: unknown, ws: Workspace) => AgentHandlerResult;

export const AGENT_TOOL_NAMES = ["join_as"] as const;
export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

const callerSchema = z.string().min(1).max(LIMITS.maxCallerChars).optional();

export const agentToolSchemas = {
  join_as: z.object({
    name: z.string().min(1).max(LIMITS.maxCallerChars),
    of: z.string().max(LIMITS.maxCallerChars).optional(),
    doing: z.string().max(LIMITS.maxCapabilityChars).optional(),
    caller: callerSchema,
  }),
} as const;

export const agentJsonSchemas: Readonly<Record<AgentToolName, Record<string, unknown>>> = {
  join_as: {
    type: "object",
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: LIMITS.maxCallerChars,
        description: "The name you want to be known by here. Say whose you are: \"Nawaf's Codex\".",
      },
      of: {
        type: "string",
        maxLength: LIMITS.maxCallerChars,
        description: "The person whose agent you are, if their name is not already in yours.",
      },
      doing: {
        type: "string",
        maxLength: LIMITS.maxCapabilityChars,
        description: "One line on what you are here to do. Shown beside your name.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
};

export const AGENT_READ_ONLY_TOOLS: readonly AgentToolName[] = [];
/** The reply lists names other people's agents chose, so it is their text, not ours. */
export const AGENT_UNTRUSTED_TOOLS: readonly AgentToolName[] = ["join_as"];

export const agentToolDescriptions: Readonly<Record<AgentToolName, string>> = {
  join_as:
    "Take a name in this room before you do anything else, then pass it as caller on every later call. Say whose agent you are (\"Nawaf's Codex\", \"Ana's Claude\"), because two agents both called Codex are unreadable to the people watching. The reply tells you the name you actually got, which may have a number added if it was taken, and who else is already here.",
};

const field = (input: unknown, key: string): string | undefined => {
  const value = (input as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

/** Drop the card this agent held under its previous name, so renaming leaves no ghost. */
function withoutOldName(ws: Workspace, old: string | null, granted: string): Workspace {
  if (old === null || old === granted) return ws;
  const cards = ws.capabilities ?? {};
  const key = capabilityKey(old);
  if (!Object.prototype.hasOwnProperty.call(cards, key)) return ws;
  const out: Record<string, Capability> = {};
  for (const [id, card] of Object.entries(cards)) {
    if (id !== key) out[id] = card;
  }
  return { ...ws, capabilities: out };
}

const others = (ws: Workspace, mine: string): string => {
  const rest = agentNames(ws).filter((name) => name.toLowerCase() !== mine.toLowerCase());
  if (rest.length === 0) {
    return "You are the only agent here so far.";
  }
  return `Also here: ${rest.join(", ")}. Address one of them by name with add_feedback.`;
};

const BARE_NOTE =
  " That name says what made you and nothing about whose you are, so the people watching cannot tell two of you apart. Call join_as again with a name like \"Nawaf's Codex\" if you can.";

const join: AgentHandler = (input, ws) => {
  const wanted = field(input, "name");
  if (wanted === undefined) return { result: "join_as needs a name." };
  const held = heldName();
  const granted = grantName(ws, wanted, held);
  setHeldName(granted);

  const of = field(input, "of");
  const doing = field(input, "doing");
  const knows = [
    ...(of === undefined ? [] : [`agent of ${of}`]),
    ...(doing === undefined ? [] : [doing]),
  ].slice(0, LIMITS.maxCapabilityLines);

  const existing = listCapabilities(ws).find(
    (card) => card.owner.name.toLowerCase() === (held ?? "").toLowerCase(),
  );
  const card: Capability = {
    owner: { kind: "agent", name: granted },
    packs: enabledPackIds(ws, inRoom()),
    local: existing?.local ?? [],
    knows: knows.length > 0 ? knows : (existing?.knows ?? []),
    updatedAt: new Date().toISOString(),
  };
  const next = publishCapability(withoutOldName(ws, held, granted), card);

  const renamed =
    granted.toLowerCase() === wanted.trim().toLowerCase()
      ? ""
      : ` "${wanted.trim()}" was already taken here, so you are "${granted}".`;
  const bare = isBareVendorName(wanted) ? BARE_NOTE : "";
  return {
    next,
    result:
      `You are "${granted}" in this room.${renamed} Pass caller: "${granted}" on every call from now on, ` +
      `so the people watching can see which agent did what.${bare} ${others(next, granted)}`,
  };
};

export const agentHandlers: Readonly<Record<AgentToolName, AgentHandler>> = {
  join_as: join,
};
