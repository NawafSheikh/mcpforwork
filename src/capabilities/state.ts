/**
 * Capability cards on the Workspace, keyed by owner name (docs/PACKS.md).
 *
 * A card says what one person, agent or robot can reach. It is a description, never a
 * permission: nothing on the board is unlocked by publishing one, and nothing is denied
 * by not having one. Reading a card is how an agent finds who to ask.
 */

import { LIMITS, type Capability, type Workspace } from "../types";
import { capabilityKey } from "./coerce";

const cardsOf = (ws: Workspace): Readonly<Record<string, Capability>> => ws.capabilities ?? {};

export function capabilityFor(ws: Workspace, name: string): Capability | null {
  return cardsOf(ws)[capabilityKey(name)] ?? null;
}

/** Newest card first, so the panel and the tool answer in the same order. */
export function listCapabilities(ws: Workspace): readonly Capability[] {
  return Object.values(cardsOf(ws)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Drop the oldest cards until one more fits under the cap. */
function withRoom(
  cards: Readonly<Record<string, Capability>>,
  key: string,
): Readonly<Record<string, Capability>> {
  const entries = Object.entries(cards);
  if (Object.prototype.hasOwnProperty.call(cards, key)) return cards;
  if (entries.length < LIMITS.maxCapabilities) return cards;
  const oldestFirst = [...entries].sort((a, b) => a[1].updatedAt.localeCompare(b[1].updatedAt));
  const drop = new Set(oldestFirst.slice(0, entries.length - LIMITS.maxCapabilities + 1).map(([id]) => id));
  const out: Record<string, Capability> = {};
  for (const [id, card] of entries) {
    if (!drop.has(id)) out[id] = card;
  }
  return out;
}

/** Store one card, replacing whatever that owner published before. */
export function publishCapability(ws: Workspace, card: Capability): Workspace {
  const key = capabilityKey(card.owner.name);
  if (key.length === 0) return ws;
  const kept = withRoom(cardsOf(ws), key);
  return { ...ws, capabilities: { ...kept, [key]: { ...card, owner: { ...card.owner, name: key } } } };
}

/** "Maria (person): board, notes, rooms; Fabric lakehouse owner" for a card summary. */
export function capabilityLine(card: Capability): string {
  const packs = card.packs.length === 0 ? "no site packs" : card.packs.join(", ");
  const extras = [...card.local, ...card.knows];
  const tail = extras.length === 0 ? "" : `; ${extras.join(", ")}`;
  return `${card.owner.name} (${card.owner.kind}): ${packs}${tail}`;
}
