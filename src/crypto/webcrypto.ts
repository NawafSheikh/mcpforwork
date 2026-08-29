/**
 * The one place that reaches for Web Crypto.
 *
 * Both getters throw a sentence a human can act on rather than returning null: a browser
 * without SubtleCrypto is almost always a page served over plain http, and "crypto.subtle
 * is undefined" sends people looking in the wrong file. Every public function that must
 * not throw (envelope.open) calls these inside its own try.
 *
 * Key material never falls back to Math.random. A room whose key came from a weak source
 * would look encrypted and not be, which is worse than a room that refuses to open.
 */

const INSECURE =
  "Web Crypto is unavailable. Encrypted rooms need a secure context: serve the page over https or on localhost.";

export function webcrypto(): Crypto {
  const crypto: Crypto | undefined = globalThis.crypto;
  if (crypto === undefined || typeof crypto.getRandomValues !== "function") throw new Error(INSECURE);
  return crypto;
}

export function subtle(): SubtleCrypto {
  const crypto = webcrypto();
  const api: SubtleCrypto | undefined = crypto.subtle;
  if (api === undefined || typeof api.importKey !== "function") throw new Error(INSECURE);
  return api;
}

/* Return types are inferred on purpose: TypeScript 5.7 made Uint8Array generic in its
   buffer, and only `new Uint8Array(n)` and `TextEncoder.encode` are narrow enough to
   satisfy WebCrypto's BufferSource. Writing `: Uint8Array` here widens them back and
   every subtle.* call stops compiling. */
export function randomBytes(count: number) {
  const out = new Uint8Array(count);
  webcrypto().getRandomValues(out);
  return out;
}

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

export function utf8(text: string) {
  return ENCODER.encode(text);
}

export function fromUtf8(bytes: ArrayBuffer): string {
  return DECODER.decode(bytes);
}
