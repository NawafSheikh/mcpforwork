/**
 * Share links. The whole board travels in the URL fragment, which browsers never send
 * to a server, so a snapshot is copied from one person to another without this app
 * gaining a backend, an account or a database.
 */
import { LIMITS, type Workspace } from "../types";
import { packBytes, unpackPayload, MAX_INFLATED_BYTES } from "./codec";
import { fromSnapshot, toSnapshot } from "./snapshot";

export const SHARE_PARAM = "share";

/** Read the payload out of a location hash, or null when there is not one. */
export function readShareParam(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (raw.length === 0) return null;
  const value = new URLSearchParams(raw).get(SHARE_PARAM);
  return value !== null && value.length > 0 ? value : null;
}

function currentHash(): string {
  const loc = (globalThis as { location?: Location }).location;
  return loc?.hash ?? "";
}

/** Synchronous, so the bootstrap can decide whether to register tools at all. */
export function hasShareFragment(hash: string = currentHash()): boolean {
  return readShareParam(hash) !== null;
}

function tooLarge(chars: number): Error {
  return new Error(
    "This board is too big to share: the link would be " +
      chars +
      " characters and the limit is " +
      LIMITS.maxShareBytes +
      ". Remove a category or a few charts, then share again.",
  );
}

/**
 * A read-only snapshot of the board as a link. Compressed with deflate-raw where the
 * browser has CompressionStream, plain base64url where it does not, and the payload
 * says which, so a link made in one browser opens in the other.
 */
export async function buildShareUrl(ws: Workspace): Promise<string> {
  const json = JSON.stringify(toSnapshot(ws));
  const payload = await packBytes(new TextEncoder().encode(json));
  if (payload.length > LIMITS.maxShareBytes) throw tooLarge(payload.length);
  const loc = (globalThis as { location?: Location }).location;
  const origin = loc?.origin ?? "";
  const path = loc?.pathname ?? "/";
  return origin + path + "#" + SHARE_PARAM + "=" + payload;
}

/** Payload string to a Workspace. Returns null for anything that does not parse. */
export async function readSharePayload(
  payload: string,
  now: Date = new Date(),
): Promise<Workspace | null> {
  const bytes = await unpackPayload(payload);
  if (bytes === null || bytes.length > MAX_INFLATED_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return fromSnapshot(parsed, now);
  } catch {
    return null;
  }
}

/**
 * The snapshot in the current location, or null. Never throws: a malformed link
 * has to fall back to the visitor's own board, not to a blank page.
 */
export async function readShareFromLocation(
  hash: string = currentHash(),
): Promise<Workspace | null> {
  const payload = readShareParam(hash);
  if (payload === null) return null;
  try {
    return await readSharePayload(payload);
  } catch {
    return null;
  }
}
