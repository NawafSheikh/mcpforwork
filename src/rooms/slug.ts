/**
 * Room slugs and room URLs.
 *
 * The slug lives in the query string (?room=abc123) and never in the fragment: the
 * fragment already carries a read-only #share= snapshot, and a link must be able to say
 * "this is the live room" or "this is a frozen picture", not both at once.
 *
 * Slugs are unlisted, not secret. Ten characters out of a 32 symbol alphabet is 50 bits,
 * which is far beyond guessing for a demo, but anyone handed the link is in the room.
 */

/** No l, o, 0 or 1: a slug gets read aloud and typed by hand during a demo. */
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export const ROOM_PARAM = "room";
export const ROOM_SLUG_LENGTH = 10;
export const ROOM_SLUG_PATTERN = /^[a-z0-9]{6,16}$/;

/** IndexedDB key for a room-scoped board, alongside the store's own mfw:workspace:<mode>. */
export function roomStoreKey(slug: string): string {
  return `mfw:workspace:room:${slug}`;
}

export function isRoomSlug(value: unknown): value is string {
  return typeof value === "string" && ROOM_SLUG_PATTERN.test(value);
}

function randomBytes(count: number): Uint8Array {
  const crypto: Crypto | undefined = globalThis.crypto;
  const out = new Uint8Array(count);
  if (crypto && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < count; i += 1) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

/**
 * A fresh slug. The alphabet is 32 symbols and a byte is 256 values, so the modulo is
 * exact and every symbol is equally likely; no rejection sampling needed.
 */
export function mintRoomSlug(length: number = ROOM_SLUG_LENGTH): string {
  const size = Math.min(Math.max(length, 6), 16);
  const bytes = randomBytes(size);
  let out = "";
  for (let i = 0; i < size; i += 1) {
    out += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  }
  return out;
}

/** The slug in a query string ("?room=abc123" or "room=abc123"), or null. */
export function readRoomSlug(search: string): string | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (raw.length === 0) return null;
  const value = new URLSearchParams(raw).get(ROOM_PARAM);
  return isRoomSlug(value) ? value : null;
}

interface LocationLike {
  readonly origin?: string;
  readonly pathname?: string;
  readonly search?: string;
}

function currentLocation(): LocationLike {
  return (globalThis as { location?: LocationLike }).location ?? {};
}

/** The room slug of the page as loaded, or null when this browser is on its own board. */
export function currentRoomSlug(search: string = currentLocation().search ?? ""): string | null {
  return readRoomSlug(search);
}

/**
 * The link a visitor sends to a colleague. Other query params (mode=live) survive;
 * the fragment is dropped so a share snapshot never rides along with a room invite.
 */
export function roomJoinUrl(slug: string, from: LocationLike = currentLocation()): string {
  const params = new URLSearchParams(
    (from.search ?? "").startsWith("?") ? (from.search ?? "").slice(1) : from.search ?? "",
  );
  params.set(ROOM_PARAM, slug);
  const query = params.toString();
  return `${from.origin ?? ""}${from.pathname ?? "/"}${query.length > 0 ? `?${query}` : ""}`;
}

/** Same page, no room. Used when a visitor leaves a room. */
export function leaveRoomUrl(from: LocationLike = currentLocation()): string {
  const params = new URLSearchParams(
    (from.search ?? "").startsWith("?") ? (from.search ?? "").slice(1) : from.search ?? "",
  );
  params.delete(ROOM_PARAM);
  const query = params.toString();
  return `${from.origin ?? ""}${from.pathname ?? "/"}${query.length > 0 ? `?${query}` : ""}`;
}
