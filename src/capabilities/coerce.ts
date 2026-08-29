/**
 * Coercing a capability card that arrived from somewhere we do not control: a peer's
 * patch, a restored board, an agent's own claim about itself.
 *
 * Nothing here is trusted. A card is a description somebody typed, so every field is
 * type checked, capped and copied into a fresh object, and a card that does not fit is
 * dropped rather than repaired.
 */

import { asIso, asRecord, asString, asStringList, isSafeKey } from "../share/coerce";
import { LIMITS, type Capability, type CapabilityOwnerKind } from "../types";

const OWNER_KINDS: readonly CapabilityOwnerKind[] = ["person", "agent", "robot"];

const LINES = LIMITS.maxCapabilityLines;
const CHARS = LIMITS.maxCapabilityChars;

function ownerKind(value: unknown): CapabilityOwnerKind {
  const text = typeof value === "string" ? value : "";
  return (OWNER_KINDS as readonly string[]).includes(text)
    ? (text as CapabilityOwnerKind)
    : "agent";
}

/** The key a card is stored under: the owner's name, trimmed. */
export function capabilityKey(name: string): string {
  return name.trim().slice(0, LIMITS.maxCallerChars).trim();
}

export function coerceCapability(raw: unknown, at: string): Capability | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const owner = asRecord(rec.owner);
  const name = asString(owner?.name, LIMITS.maxCallerChars);
  if (name === undefined || !isSafeKey(capabilityKey(name))) return null;
  return {
    owner: { kind: ownerKind(owner?.kind), name: capabilityKey(name) },
    packs: asStringList(rec.packs, LINES, CHARS),
    local: asStringList(rec.local, LINES, CHARS),
    knows: asStringList(rec.knows, LINES, CHARS),
    updatedAt: asIso(rec.updatedAt, at),
  };
}
