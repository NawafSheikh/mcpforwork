/**
 * The three turn tools, in the shape the registry uses: (input, ws) => {next?, result}.
 *
 * All three are optional. Writing already claims the object for the caller and releases it
 * when the work is finished, so an agent that never calls any of these still shows up on
 * the card and still gets its changes merged. They exist for the cases where saying so
 * early helps: a long job you are about to start, a job you abandoned, and a look at what
 * everybody else is doing. Nothing here blocks anybody, and nothing here can be used to
 * take an object away from somebody who is working on it.
 *
 * The names are merged into src/webmcp/schemas.ts the same way the room and dataset tools
 * are: from this leaf file, so registering a tool never drags a React view into zod.
 */
import { z } from "zod";
import { LIMITS, type ClaimTarget, type Workspace } from "../types";
import {
  AGENT_FALLBACK,
  CLAIM_KINDS,
  claimAge,
  claimOn,
  clockTime,
  describeClaimTarget,
  dropClaim,
  holdClaim,
  isHolder,
  liveClaims,
  pruneClaims,
  workingOnText,
} from "./claims";
import { readClaimTarget } from "./gate";

export interface TurnHandlerResult {
  readonly next?: Workspace;
  readonly result: string;
}

export type TurnHandler = (input: unknown, ws: Workspace) => TurnHandlerResult;

export const TURN_TOOL_NAMES = ["claim", "release", "list_claims"] as const;
export type TurnToolName = (typeof TURN_TOOL_NAMES)[number];

const callerSchema = z.string().min(1).max(LIMITS.maxCallerChars).optional();

const claimTargetSchema = z.object({
  kind: z.enum(["dashboard", "overview", "monitor", "note"]),
  id: z.string().min(1).max(80),
});

/** caller is copied into `from` so the handler can sign the turn with it. */
const turnTool = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, caller: callerSchema }).transform((value) => ({ ...value, from: value.caller }));

export const turnToolSchemas = {
  claim: turnTool({ target: claimTargetSchema }),
  release: turnTool({ target: claimTargetSchema }),
  list_claims: turnTool({}),
} as const;

const targetSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: [...CLAIM_KINDS],
      description: "What you are working on: a dashboard, the overview, a monitor or a note.",
    },
    id: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      description: "Category name, the word overview, a monitor id, or a feedback id.",
    },
  },
  required: ["kind", "id"],
  additionalProperties: false,
};

export const turnJsonSchemas: Readonly<Record<TurnToolName, Record<string, unknown>>> = {
  claim: { type: "object", properties: { target: targetSchema }, required: ["target"], additionalProperties: false },
  release: { type: "object", properties: { target: targetSchema }, required: ["target"], additionalProperties: false },
  list_claims: { type: "object", properties: {}, additionalProperties: false },
};

export const turnToolDescriptions: Readonly<Record<TurnToolName, string>> = {
  claim:
    "Optional. Writing already puts your name on an object, so call this only to say early that you are starting on a dashboard, the overview, a monitor or a note, for example before a long job. Everyone sees your name on the card. It blocks nobody: other agents can still write, and their change is merged on top of yours. Pass caller so the card carries your name.",
  release:
    "Optional. Take your name off an object you are no longer working on. The write that finishes the work already does this, and a name nobody refreshed disappears on its own after 10 minutes. Somebody else's name is never touched.",
  list_claims:
    "See who is working on what right now: every live claim with the object, the holder, whether it is a person or an agent, and how long it has been held. Useful for picking up something nobody is mid-edit on, and for addressing a note to the right agent. Nothing here stops you writing. Expired claims are never listed.",
};

/** list_claims reads; the other two move a turn. */
export const TURN_READ_ONLY_TOOLS: readonly TurnToolName[] = ["list_claims"];
/** Holder names are typed by other people, so the listing is untrusted content. */
export const TURN_UNTRUSTED_CONTENT_TOOLS: readonly TurnToolName[] = ["list_claims"];

const MAX_LISTED = 20;

function callerOf(input: unknown): string {
  if (typeof input !== "object" || input === null) return AGENT_FALLBACK;
  const from = (input as { from?: unknown }).from;
  return typeof from === "string" && from.trim().length > 0 ? from.trim() : AGENT_FALLBACK;
}

const badTargetText =
  'claim needs target {kind, id}, where kind is dashboard, overview, monitor or note. Nothing changed.';

const claimTool: TurnHandler = (input, ws) => {
  const target = readClaimTarget(input);
  if (target === null) return { result: badTargetText };
  const now = new Date();
  const holder = callerOf(input);
  const existing = claimOn(ws, target, now);
  // Somebody else's name is never taken off an object. Both of you can still write.
  if (existing !== null && !isHolder(existing, holder)) {
    return {
      result: `${workingOnText(existing, now)} Write when you need to: your change is merged on top, and only the same chart or KPI changed twice comes back to you.`,
    };
  }
  const next = holdClaim(ws, { target, holder, holderKind: "agent" }, now);
  const until = clockTime(next.claims[`${target.kind}:${target.id}`]?.expiresAt ?? now.toISOString());
  return {
    next,
    result:
      `Your name is on ${describeClaimTarget(target)} until ${until}, and everybody here sees it. ` +
      "It blocks nobody. The write that finishes the work takes it off again.",
  };
};

const releaseTool: TurnHandler = (input, ws) => {
  const target = readClaimTarget(input);
  if (target === null) return { result: badTargetText };
  const now = new Date();
  const claim = claimOn(ws, target, now);
  if (claim === null) {
    const pruned = pruneClaims(ws, now);
    return {
      ...(pruned === ws ? {} : { next: pruned }),
      result: `Nothing to release on ${describeClaimTarget(target)}: no name is on it.`,
    };
  }
  if (!isHolder(claim, callerOf(input))) {
    return { result: `${workingOnText(claim, now)} Only they take their own name off.` };
  }
  return {
    next: dropClaim(ws, target, now),
    result: `Your name is off ${describeClaimTarget(target)}.`,
  };
};

interface ClaimRow {
  readonly target: ClaimTarget;
  readonly holder: string;
  readonly holderKind: string;
  readonly held: string;
  readonly since: string;
  readonly expiresAt: string;
}

/** Trim from the end until the JSON fits, so the agent never reads half an object. */
function rowsText(rows: readonly ClaimRow[]): string {
  for (let count = Math.min(rows.length, MAX_LISTED); count > 0; count -= 1) {
    const text = JSON.stringify({ claims: rows.slice(0, count), shown: count, total: rows.length });
    if (text.length <= LIMITS.toolOutputChars) return text;
  }
  return JSON.stringify({ claims: [], shown: 0, total: rows.length, truncated: true });
}

const NOBODY =
  "Nobody is working on anything right now. Just write: your name goes on whatever you change, and comes off when you finish it.";

const listClaimsTool: TurnHandler = (_input, ws) => {
  const now = new Date();
  const claims = liveClaims(ws, now);
  if (claims.length === 0) return { result: NOBODY };
  const rows: readonly ClaimRow[] = claims.map((claim) => ({
    target: claim.target,
    holder: claim.holder,
    holderKind: claim.holderKind,
    held: claimAge(claim, now),
    since: claim.since,
    expiresAt: claim.expiresAt,
  }));
  return { result: rowsText(rows) };
};

export const turnHandlers: Readonly<Record<TurnToolName, TurnHandler>> = {
  claim: claimTool,
  release: releaseTool,
  list_claims: listClaimsTool,
};
