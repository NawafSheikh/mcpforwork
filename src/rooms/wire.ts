/**
 * The untrusted edge of a room.
 *
 * Anything arriving from the relay was written by a stranger's browser, so it is treated
 * exactly like a share fragment: type checked, capped, copied into a fresh object, and
 * dropped when it does not fit. The primitive coercers are reused from src/share/coerce
 * so there is one set of rules for "somebody else's JSON" in this codebase.
 */
import { PATCH_KINDS, ROOM_LIMITS, type PatchKind, type PeerInfo, type RoomMessage, type RoomPatch } from "./types";
import { CAP } from "../share/caps";
import { asArray, asEnum, asIso, asOptionalEnum, asRecord, asString, asText, isSafeKey } from "../share/coerce";
import { LIMITS, type Actor, type AuditEvent } from "../types";

const ACTORS: readonly Actor[] = ["agent", "human", "system"];
const CLIENT_ID_CHARS = 40;
const KEY_CHARS = 120;

/** UTF-8 size of a string, so the message cap means the same thing the relay means. */
export function byteLength(text: string): number {
  const encoder = (globalThis as { TextEncoder?: typeof TextEncoder }).TextEncoder;
  if (encoder) return new encoder().encode(text).length;
  return text.length;
}

/** An audit event from another browser. Never trusted, always rebuilt field by field. */
export function coerceAuditEvent(raw: unknown, at: string): AuditEvent | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const id = asString(rec.id, CAP.label);
  if (id === undefined || !isSafeKey(id)) return null;
  const caller = asString(rec.caller, LIMITS.maxCallerChars);
  const tool = asString(rec.tool, CAP.label);
  const argsHash = asString(rec.argsHash, 16);
  const argsPreview = asString(rec.argsPreview, CAP.summary);
  const result = asString(rec.result, CAP.summary);
  return {
    id,
    at: asIso(rec.at, at),
    actor: asEnum(rec.actor, ACTORS, "agent"),
    ...(caller ? { caller } : {}),
    ...(tool ? { tool } : {}),
    ...(argsHash ? { argsHash } : {}),
    ...(argsPreview ? { argsPreview } : {}),
    ...(result ? { result } : {}),
    ok: rec.ok !== false,
  };
}

/** One patch. The `value` stays raw here: the kind-specific coercer runs at apply time. */
export function coercePatch(raw: unknown, at: string): RoomPatch | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const kind = asOptionalEnum<PatchKind>(rec.kind, PATCH_KINDS);
  const key = asString(rec.key, KEY_CHARS);
  const origin = asString(rec.origin, CLIENT_ID_CHARS);
  if (kind === undefined || key === undefined || origin === undefined) return null;
  if (!isSafeKey(key)) return null;
  return { kind, key, value: rec.value === undefined ? null : rec.value, at: asIso(rec.at, at), origin };
}

function coercePatches(raw: unknown, at: string): readonly RoomPatch[] {
  const out: RoomPatch[] = [];
  let auditKept = 0;
  for (const item of asArray(raw, ROOM_LIMITS.patchesPerMessage)) {
    const patch = coercePatch(item, at);
    if (patch === null) continue;
    if (patch.kind === "audit") {
      if (auditKept >= ROOM_LIMITS.auditPerMessage) continue;
      auditKept += 1;
    }
    out.push(patch);
  }
  return out;
}

export function coercePeer(raw: unknown, fallbackId: string, at: string): PeerInfo | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const clientId = asString(rec.clientId, CLIENT_ID_CHARS) ?? fallbackId;
  if (!isSafeKey(clientId)) return null;
  const entities = typeof rec.entities === "number" && Number.isFinite(rec.entities) ? rec.entities : 0;
  return {
    clientId,
    label: asText(rec.label, ROOM_LIMITS.labelChars, "Someone"),
    agent: rec.agent === true,
    updatedAt: asIso(rec.updatedAt, at),
    entities: Math.max(0, Math.floor(entities)),
  };
}

function coerceHello(rec: Record<string, unknown>, from: string, at: string): RoomMessage | null {
  const peer = coercePeer(rec.peer, from, at);
  return peer === null ? null : { t: "hello", from, at, peer };
}

function coerceState(rec: Record<string, unknown>, from: string, at: string): RoomMessage | null {
  const to = asString(rec.to, CLIENT_ID_CHARS);
  if (to === undefined || rec.snapshot === undefined) return null;
  return { t: "state", from, at, to, snapshot: rec.snapshot };
}

/**
 * Untrusted JSON to a RoomMessage, or null. Never throws: a malformed frame is a dropped
 * frame, and the sync engine audits the drop rather than letting it reach the store.
 */
export function coerceMessage(raw: unknown, now: Date = new Date()): RoomMessage | null {
  const rec = asRecord(raw);
  if (rec === null) return null;
  const at = asIso(rec.at, now.toISOString());
  const from = asString(rec.from, CLIENT_ID_CHARS);
  if (from === undefined || !isSafeKey(from)) return null;
  switch (rec.t) {
    case "hello":
      return coerceHello(rec, from, at);
    case "bye":
      return { t: "bye", from, at };
    case "need":
      return { t: "need", from, at };
    case "patch":
      return { t: "patch", from, at, patches: coercePatches(rec.patches, at) };
    case "state":
      return coerceState(rec, from, at);
    default:
      return null;
  }
}

/** Serialize for the wire, or null when the message is over the relay's payload budget. */
export function encodeMessage(message: RoomMessage): string | null {
  let text: string;
  try {
    text = JSON.stringify(message);
  } catch {
    return null;
  }
  return byteLength(text) > ROOM_LIMITS.maxMessageBytes ? null : text;
}
