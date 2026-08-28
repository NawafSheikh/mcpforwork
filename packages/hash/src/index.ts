/**
 * Tiny dependency-free hashing used by the ported control-plane packages.
 * Ported from mcpforwork-d365-control-plane, 28 Aug 2026: the original called
 * node:crypto createHash, which does not exist in the browser. FNV-1a keeps the
 * synchronous call sites working; sha256Hex is the Web Crypto async equivalent.
 */

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

/** Deterministic 64-bit FNV-1a over the UTF-16 bytes of the input, as 16 hex chars. */
export function fnv1a64(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    hash = ((hash ^ BigInt(code & 0xff)) * FNV_PRIME) & UINT64_MASK;
    if (code > 0xff) {
      hash = ((hash ^ BigInt((code >> 8) & 0xff)) * FNV_PRIME) & UINT64_MASK;
    }
  }
  return hash.toString(16).padStart(16, "0");
}

/** Stable key ordering so two equal objects always digest to the same string. */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, canonicalize(source[key])]),
    );
  }
  return value;
}

/** Async SHA-256 through Web Crypto, for callers that can await a real digest. */
export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto subtle is unavailable in this context.");
  }
  const bytes = new TextEncoder().encode(input);
  const digest = await subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Short, URL-safe, collision-resistant-enough identifier suffix. */
export function shortId(...parts: readonly string[]): string {
  return fnv1a64(parts.join("|")).slice(0, 10);
}
