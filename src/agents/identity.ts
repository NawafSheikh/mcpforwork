/**
 * Who an agent is in this room.
 *
 * Nawaf, 30 Aug: two agents both called Codex is unreadable. Every rail line, every claim,
 * every addressed note and every capability card is keyed by a self-declared `caller`, and
 * self-declared names collide the moment a second person's agent arrives.
 *
 * So an agent claims a name once, and the page decides what it actually gets. Two rules:
 *   1. A name already taken by somebody else here is granted with a number on the end.
 *   2. A bare vendor name is granted, and the agent is told why it is a bad one, because
 *      refusing it would leave the agent with no name at all.
 *
 * The claim is not a permission and it is not a token. It is a label the room agrees on,
 * exactly like the display name a person types. What makes it stable is that each agent
 * talks to its own copy of the page, so this module holds one name per page and a repeat
 * claim of the same name is the same claim, not a second agent.
 */

import { capabilityKey } from "../capabilities/coerce";
import { listCapabilities } from "../capabilities/state";
import { LIMITS, type Workspace } from "../types";

/** Names that say what made the agent and nothing about whose it is. */
export const BARE_VENDOR_NAMES: readonly string[] = [
  "codex",
  "chatgpt",
  "gpt",
  "claude",
  "agent",
  "assistant",
  "ai",
  "bot",
  "copilot",
  "gemini",
];

export function isBareVendorName(name: string): boolean {
  return BARE_VENDOR_NAMES.includes(name.trim().toLowerCase());
}

/** Every agent name the board currently knows about, from the capability cards. */
export function agentNames(ws: Workspace): readonly string[] {
  return listCapabilities(ws)
    .filter((card) => card.owner.kind === "agent")
    .map((card) => card.owner.name);
}

/**
 * The name this agent gets. `held` is the name this page already granted, which is never
 * treated as a collision with itself: an agent repeating its claim keeps its name.
 */
export function grantName(ws: Workspace, wanted: string, held: string | null): string {
  const base = capabilityKey(wanted) || "Agent";
  const mine = held === null ? null : base.toLowerCase() === held.toLowerCase();
  if (mine === true) return held as string;
  const taken = new Set(
    agentNames(ws)
      .filter((name) => held === null || name.toLowerCase() !== held.toLowerCase())
      .map((name) => name.toLowerCase()),
  );
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 50; n += 1) {
    const candidate = `${base} ${n}`.slice(0, LIMITS.maxCallerChars).trim();
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Date.now() % 1000}`.slice(0, LIMITS.maxCallerChars).trim();
}

/**
 * One name per page, because one page is one agent. Module state on purpose: it must not
 * sync, and it must not survive a reload into a room where somebody else took the name.
 */
let held: string | null = null;

export function heldName(): string | null {
  return held;
}

export function setHeldName(name: string | null): void {
  held = name;
}

export function resetIdentity(): void {
  held = null;
}
