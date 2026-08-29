/**
 * Coercing a pack switch that arrived from a peer or from a restored board.
 *
 * A switch is one boolean and two labels, so there is very little to get wrong and
 * exactly one thing that matters: a pack id this build does not know is dropped rather
 * than stored, so a peer on a newer build cannot leave a switch here that nothing renders.
 */

import { asIso, asRecord, asString } from "../share/coerce";
import { LIMITS, type PackState } from "../types";
import { packById } from "./registry";

export function coercePackState(raw: unknown, at: string): PackState | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const id = asString(rec.id, 40);
  if (id === undefined || packById(id) === null) return null;
  if (typeof rec.enabled !== "boolean") return null;
  return {
    id,
    enabled: rec.enabled,
    changedBy: asString(rec.changedBy, LIMITS.maxCallerChars) ?? "Someone",
    changedAt: asIso(rec.changedAt, at),
  };
}
