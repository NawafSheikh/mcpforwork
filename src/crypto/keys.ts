/**
 * Room keys: where the secret comes from, what it turns into, and where it lives.
 *
 * One rule shapes this file: nobody types anything. A room mints a secret when it is
 * created, the secret rides in the invite link's fragment, and the fragment is the one
 * part of a URL that browsers never send to a server. There is no passphrase, no setting
 * and no key exchange, because every one of those is a step a person can get wrong.
 *
 * The AES key is derived, not stored. HKDF binds the secret to the room slug, so the same
 * secret in a different room is a different key, and the derived key is non-extractable:
 * once it exists, no script on the page can read the bytes back out of it.
 */
import { fromBase64url, toBase64url, toHex } from "./base64url";
import { readFragmentParam, writeFragmentParam } from "./fragment";
import { randomBytes, subtle, utf8 } from "./webcrypto";

/** Fragment parameter that carries the secret. Short on purpose: invite links get pasted. */
export const SECRET_PARAM = "k";
export const ROOM_SECRET_BYTES = 32;
export const FINGERPRINT_CHARS = 8;

/** Accepts a wider range than we mint so a future longer secret still opens today's rooms. */
const MIN_SECRET_BYTES = 16;
const MAX_SECRET_BYTES = 64;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{22,88}$/;

/** Domain separation. A room key, a fingerprint and any later use never share a derivation. */
const HKDF_SALT = "mfw-room-key|v1";
const FINGERPRINT_DOMAIN = "mfw-room-fp|v1|";

/** 32 random bytes as base64url: 43 characters, 256 bits, no padding to mangle. */
export function generateRoomSecret(): string {
  return toBase64url(randomBytes(ROOM_SECRET_BYTES));
}

export function isRoomSecret(value: unknown): value is string {
  if (typeof value !== "string" || !SECRET_PATTERN.test(value)) return false;
  const bytes = fromBase64url(value);
  return bytes !== null && bytes.length >= MIN_SECRET_BYTES && bytes.length <= MAX_SECRET_BYTES;
}

function secretBytes(secret: string) {
  const bytes = isRoomSecret(secret) ? fromBase64url(secret) : null;
  if (bytes === null) throw new Error("That room key is not a valid secret. Ask for the full invite link again.");
  return bytes;
}

/**
 * secret + slug -> AES-GCM 256, non-extractable.
 *
 * The slug is the HKDF info, so a ciphertext from one room cannot be decrypted in another
 * even if the same link were reused. envelope.ts binds the slug a second time, in the
 * additional data, so replay across rooms fails on both the key and the tag.
 */
export async function deriveRoomKey(secret: string, slug: string): Promise<CryptoKey> {
  const api = subtle();
  const material = await api.importKey("raw", secretBytes(secret), "HKDF", false, ["deriveKey"]);
  return api.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: utf8(HKDF_SALT), info: utf8(slug) },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Eight hex characters of SHA-256 over a domain-separated secret. Two people on a call
 * read it aloud and know they are in the same room; the badge shows it next to presence.
 * It is a hint, not a credential: it is derived from the secret and never proves holding it.
 */
export async function fingerprint(secret: string): Promise<string> {
  const digest = await subtle().digest("SHA-256", utf8(FINGERPRINT_DOMAIN + secret));
  return toHex(new Uint8Array(digest)).slice(0, FINGERPRINT_CHARS);
}

/** The key in a location hash, or null. Coexists with "#share=" in either order. */
export function readSecretFromFragment(hash: string): string | null {
  const value = readFragmentParam(hash, SECRET_PARAM);
  return value !== null && isRoomSecret(value) ? value : null;
}

/** The same hash with the key set, leaving "#share=" and anything else exactly as it was. */
export function writeSecretToFragment(hash: string, secret: string): string {
  return writeFragmentParam(hash, SECRET_PARAM, secret);
}
