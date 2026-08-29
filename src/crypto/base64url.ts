/**
 * base64url, hand rolled.
 *
 * src/share/codec.ts already has a btoa/atob pair, but that module is about board
 * snapshots and this one is about key material, so crypto stays dependency free in both
 * directions: nothing here imports another feature folder, and no global beyond
 * TextEncoder is assumed. Unpadded, RFC 4648 section 5, the same shape share links use.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const LOOKUP: ReadonlyMap<string, number> = new Map([...ALPHABET].map((ch, i) => [ch, i]));

/** charAt, not [], because noUncheckedIndexedAccess types the index access as maybe undefined. */
function symbol(index: number): string {
  return ALPHABET.charAt(index);
}

export function toBase64url(bytes: Uint8Array): string {
  let out = "";
  let acc = 0;
  let bits = 0;
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += symbol((acc >> bits) & 63);
    }
  }
  if (bits > 0) out += symbol((acc << (6 - bits)) & 63);
  return out;
}

/** null for anything that is not base64url, so callers can branch instead of catching. */
export function fromBase64url(text: string) {
  const clean = text.replace(/=+$/, "");
  if (clean.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((clean.length * 6) / 8));
  let acc = 0;
  let bits = 0;
  let written = 0;
  for (const ch of clean) {
    const value = LOOKUP.get(ch);
    if (value === undefined) return null;
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[written] = (acc >> bits) & 0xff;
      written += 1;
    }
  }
  return out.subarray(0, written);
}

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}
