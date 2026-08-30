/**
 * Coercing a loop that arrived from somewhere we do not control: a peer's patch or a
 * restored board. Same rules as the rest of src/share: fresh objects, hard caps, unknown
 * keys dropped, anything that does not fit dropped rather than repaired.
 */

import { asIso, asNumber, asRecord, asString, isSafeKey } from "../share/coerce";
import { LIMITS, type Loop, type LoopState, type TaskRecord } from "../types";

const STATES: readonly LoopState[] = ["idle", "running", "held", "failed", "off"];

function coerceRecord(raw: unknown, at: string): TaskRecord | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const text = asString(rec.text, LIMITS.maxTaskRecordChars);
  if (text === undefined) return null;
  return {
    at: asIso(rec.at, at),
    by: asString(rec.by, LIMITS.maxCallerChars) ?? "unknown",
    byKind: rec.byKind === "person" ? "person" : "agent",
    text,
    ...(rec.evidence === true ? { evidence: true } : {}),
  };
}

export function coerceLoop(raw: unknown, at: string): Loop | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const id = asString(rec.id, 60);
  const name = asString(rec.name, LIMITS.maxLoopNameChars);
  const does = asString(rec.does, LIMITS.maxLoopDoesChars);
  if (id === undefined || name === undefined || does === undefined || !isSafeKey(id)) return null;

  const layerValue = asNumber(rec.layer) ?? 0;
  const layer = Math.min(Math.max(Math.floor(layerValue), 0), LIMITS.maxLoopLayers - 1);
  const feeds = asString(rec.feeds, 60);
  const every = asString(rec.every, 60);
  const lastSaid = asString(rec.lastSaid, LIMITS.maxTaskRecordChars);
  const lastRunAt = asString(rec.lastRunAt, 40) === undefined ? undefined : asIso(rec.lastRunAt, at);
  const stateText = typeof rec.state === "string" ? rec.state : "";
  const records = (Array.isArray(rec.records) ? rec.records : [])
    .slice(-LIMITS.maxTaskRecords)
    .map((item) => coerceRecord(item, at))
    .filter((item): item is TaskRecord => item !== null);

  return {
    id,
    name,
    does,
    layer,
    ...(feeds !== undefined && feeds !== id ? { feeds } : {}),
    host: asString(rec.host, LIMITS.maxCallerChars) ?? "unknown",
    ...(every === undefined ? {} : { every }),
    state: (STATES as readonly string[]).includes(stateText) ? (stateText as LoopState) : "idle",
    ...(lastRunAt === undefined ? {} : { lastRunAt }),
    ...(lastSaid === undefined ? {} : { lastSaid }),
    records,
    createdAt: asIso(rec.createdAt, at),
    updatedAt: asIso(rec.updatedAt, at),
  };
}
