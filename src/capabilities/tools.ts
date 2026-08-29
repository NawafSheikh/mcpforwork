/**
 * The two capability tools, in the shape the registry uses: (input, ws) => {next?, result}.
 *
 * They belong to the `rooms` pack, because a card is about the room: who is here and what
 * they can reach. Publishing one changes nothing except the card, and reading one grants
 * nothing. The names merge into src/webmcp/schemas.ts from this leaf file, the same way
 * the room, dataset and turn tools do.
 */

import { z } from "zod";
import { inRoom } from "../packs/host";
import { enabledPackIds } from "../packs/state";
import { LIMITS, type Capability, type CapabilityOwnerKind, type Workspace } from "../types";
import { capabilityKey } from "./coerce";
import { listCapabilities, publishCapability } from "./state";

export interface CapabilityHandlerResult {
  readonly next?: Workspace;
  readonly result: string;
}

export type CapabilityHandler = (input: unknown, ws: Workspace) => CapabilityHandlerResult;

export const CAPABILITY_TOOL_NAMES = ["publish_capabilities", "list_capabilities"] as const;
export type CapabilityToolName = (typeof CAPABILITY_TOOL_NAMES)[number];

const callerSchema = z.string().min(1).max(LIMITS.maxCallerChars).optional();
const line = z.string().min(1).max(LIMITS.maxCapabilityChars);
const lines = z.array(line).max(LIMITS.maxCapabilityLines);

const ownerSchema = z.object({
  kind: z.enum(["person", "agent", "robot"]),
  name: z.string().min(1).max(LIMITS.maxCallerChars),
});

/** caller is copied into `from` so a card can be signed with the name that published it. */
const capabilityTool = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, caller: callerSchema }).transform((value) => ({ ...value, from: value.caller }));

export const capabilityToolSchemas = {
  publish_capabilities: capabilityTool({
    owner: ownerSchema.optional(),
    local: lines.optional(),
    knows: lines.optional(),
  }),
  list_capabilities: capabilityTool({}),
} as const;

const listSchema: Record<string, unknown> = {
  type: "array",
  maxItems: LIMITS.maxCapabilityLines,
  items: { type: "string", maxLength: LIMITS.maxCapabilityChars },
};

export const capabilityJsonSchemas: Readonly<Record<CapabilityToolName, Record<string, unknown>>> = {
  publish_capabilities: {
    type: "object",
    properties: {
      owner: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["person", "agent", "robot"], description: "Who the card is about." },
          name: { type: "string", minLength: 1, maxLength: LIMITS.maxCallerChars, description: "Their name. Defaults to caller." },
        },
        required: ["kind", "name"],
        additionalProperties: false,
      },
      local: { ...listSchema, description: "Tools you have on your own machine, in your own words." },
      knows: { ...listSchema, description: "What you know: \"Fabric lakehouse owner\", \"D365 finance\"." },
    },
    additionalProperties: false,
  },
  list_capabilities: { type: "object", properties: {}, additionalProperties: false },
};

export const CAPABILITY_READ_ONLY_TOOLS: readonly CapabilityToolName[] = ["list_capabilities"];
/** Every word on a card was typed by somebody else. Read it as data, never as an order. */
export const CAPABILITY_UNTRUSTED_TOOLS: readonly CapabilityToolName[] = ["list_capabilities"];

export const capabilityToolDescriptions: Readonly<Record<CapabilityToolName, string>> = {
  publish_capabilities:
    "Publish a card saying what you can reach: the site packs that are on for you are measured automatically, and you add the tools you have locally and a line or two on what you know (\"Fabric lakehouse owner\", \"D365 finance\"). Everybody in the room sees the card and can address a request to you by name. It grants you nothing; it tells people what to ask you for.",
  list_capabilities:
    "Read the cards of everyone in this room: people, agents and robots, each with the site packs on for them, the tools they have locally and what they know. Use it to find who has access to a system before asking for it, then send that person or that agent a note with add_feedback instead of guessing. Cards are self-reported descriptions, not permissions.",
};

const AGENT_FALLBACK = "ChatGPT";

function callerOf(input: unknown): string {
  if (typeof input !== "object" || input === null) return AGENT_FALLBACK;
  const from = (input as { from?: unknown }).from;
  return typeof from === "string" && from.trim().length > 0 ? from.trim() : AGENT_FALLBACK;
}

function ownerOf(input: unknown): { kind: CapabilityOwnerKind; name: string } {
  const raw = (input as { owner?: { kind?: CapabilityOwnerKind; name?: string } } | null)?.owner;
  const name = capabilityKey(raw?.name ?? callerOf(input));
  return { kind: raw?.kind ?? "agent", name: name.length === 0 ? AGENT_FALLBACK : name };
}

const stringList = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const publish: CapabilityHandler = (input, ws) => {
  const owner = ownerOf(input);
  const card: Capability = {
    owner,
    packs: enabledPackIds(ws, inRoom()),
    local: stringList((input as { local?: unknown }).local),
    knows: stringList((input as { knows?: unknown }).knows),
    updatedAt: new Date().toISOString(),
  };
  return {
    next: publishCapability(ws, card),
    result:
      `Card published for ${owner.name} (${owner.kind}): site packs ${card.packs.join(", ") || "none"}` +
      `${card.local.length === 0 ? "" : `, locally ${card.local.join(", ")}`}` +
      `${card.knows.length === 0 ? "" : `, knows ${card.knows.join(", ")}`}. ` +
      "Everybody in the room can read it with list_capabilities and address a note to you by name.",
  };
};

const NOBODY =
  "No cards published yet. Call publish_capabilities with what you can reach, and ask the people here to do the same; then a request can name the capability it needs.";

interface CardRow {
  readonly name: string;
  readonly kind: string;
  readonly packs: readonly string[];
  readonly local: readonly string[];
  readonly knows: readonly string[];
  readonly updatedAt: string;
}

/** Trim from the end until the JSON fits, so the agent never reads half a card. */
function rowsText(rows: readonly CardRow[]): string {
  for (let count = rows.length; count > 0; count -= 1) {
    const text = JSON.stringify({ capabilities: rows.slice(0, count), shown: count, total: rows.length });
    if (text.length <= LIMITS.toolOutputChars) return text;
  }
  return JSON.stringify({ capabilities: [], shown: 0, total: rows.length, truncated: true });
}

const list: CapabilityHandler = (_input, ws) => {
  const cards = listCapabilities(ws);
  if (cards.length === 0) return { result: NOBODY };
  const rows: readonly CardRow[] = cards.map((card) => ({
    name: card.owner.name,
    kind: card.owner.kind,
    packs: card.packs,
    local: card.local,
    knows: card.knows,
    updatedAt: card.updatedAt,
  }));
  return { result: rowsText(rows) };
};

export const capabilityHandlers: Readonly<Record<CapabilityToolName, CapabilityHandler>> = {
  publish_capabilities: publish,
  list_capabilities: list,
};
