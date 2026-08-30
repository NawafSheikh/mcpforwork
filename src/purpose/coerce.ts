/**
 * A tool choice that arrived from a peer or a restored board.
 *
 * The reason on a card was typed by somebody else's agent, so it is capped and copied like
 * every other string that crosses. A choice naming a pack this build does not have is
 * dropped rather than kept as a row nothing can act on.
 */

import { packById } from "../packs/registry";
import { asIso, asRecord, asString, isSafeKey } from "../share/coerce";
import { LIMITS, type ToolChoice } from "../types";

export function coerceToolChoice(raw: unknown, at: string): ToolChoice | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const pack = asString(rec.pack, 40);
  const why = asString(rec.why, LIMITS.maxToolReasonChars);
  if (pack === undefined || why === undefined || !isSafeKey(pack)) return null;
  if (packById(pack) === null) return null;
  return {
    pack,
    on: rec.on === true,
    why,
    by: asString(rec.by, LIMITS.maxCallerChars) ?? "unknown",
    ...(rec.proposed === true ? { proposed: true } : {}),
    at: asIso(rec.at, at),
  };
}

export function coercePurpose(raw: unknown): string | undefined {
  return asString(raw, LIMITS.maxPurposeChars);
}
