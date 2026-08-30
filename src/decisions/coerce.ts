/**
 * A decision that arrived from a peer or a restored board.
 *
 * Everything in one was written by somebody else's agent, so it is capped and copied like
 * any other crossing text. A record whose choice is not among its own options is dropped:
 * that shape cannot be drawn honestly, and repairing it would mean inventing the part
 * that is missing.
 */

import { asIso, asRecord, asString, isSafeKey } from "../share/coerce";
import { LIMITS, type Decision } from "../types";

function lines(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw.slice(0, LIMITS.maxConsidered)) {
    const text = asString(item, LIMITS.maxDecisionChars);
    if (text !== undefined) out.push(text);
  }
  return out;
}

export function coerceDecision(raw: unknown, at: string): Decision | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const id = asString(rec.id, 80);
  const what = asString(rec.what, LIMITS.maxDecisionChars);
  const chose = asString(rec.chose, LIMITS.maxDecisionChars);
  const because = asString(rec.because, LIMITS.maxDecisionChars);
  if (id === undefined || what === undefined || chose === undefined || because === undefined) return null;
  if (!isSafeKey(id)) return null;

  const considered = lines(rec.considered);
  const chosenWasAnOption = considered.some(
    (option) => option.trim().toLowerCase() === chose.trim().toLowerCase(),
  );
  if (!chosenWasAnOption) return null;

  const objection = asRecord(rec.disagreed);
  const said = objection === null ? undefined : asString(objection.said, LIMITS.maxDecisionChars);
  const disagreedBy = objection === null ? undefined : asString(objection.by, LIMITS.maxCallerChars);

  return {
    id,
    what,
    considered,
    chose,
    because,
    by: asString(rec.by, LIMITS.maxCallerChars) ?? "unknown",
    ...(said !== undefined && disagreedBy !== undefined
      ? { disagreed: { by: disagreedBy, said, at: asIso(objection?.at, at) } }
      : {}),
    at: asIso(rec.at, at),
  };
}
