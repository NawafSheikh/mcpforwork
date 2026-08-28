/**
 * Share payload codec: JSON bytes, deflate-raw when the browser has CompressionStream,
 * then base64url. The first character of the payload is the format flag, so a link made
 * in a browser without CompressionStream still opens in one that has it. A deflated link
 * needs DecompressionStream to open, which every browser that has the compressing half
 * also has.
 */

export const FLAG_DEFLATE = "1";
export const FLAG_PLAIN = "0";

/** Hard ceiling on anything we inflate, so a tiny fragment cannot expand into a bomb. */
export const MAX_INFLATED_BYTES = 400_000;

const BASE64URL_RE = /^[A-Za-z0-9_-]*$/;
const BINARY_CHUNK = 0x8000;

interface ByteTransform {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
}

interface ByteTransformCtor {
  new (format: string): ByteTransform;
}

/** Read the constructor off globalThis so the build never depends on the DOM lib having it. */
function transformCtor(name: string): ByteTransformCtor | null {
  const value = (globalThis as unknown as Record<string, unknown>)[name];
  return typeof value === "function" ? (value as unknown as ByteTransformCtor) : null;
}

export function hasCompression(): boolean {
  return transformCtor("CompressionStream") !== null;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += BINARY_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BINARY_CHUNK));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(text: string): Uint8Array | null {
  if (!BASE64URL_RE.test(text)) return null;
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    text.length + ((4 - (text.length % 4)) % 4),
    "=",
  );
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function drain(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    const chunk = step.value;
    if (chunk === undefined) continue;
    total += chunk.length;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function pipe(
  ctorName: string,
  bytes: Uint8Array,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const Ctor = transformCtor(ctorName);
  if (Ctor === null) return null;
  try {
    const transform = new Ctor("deflate-raw");
    const writer = transform.writable.getWriter();
    const written = writer
      .write(bytes)
      .then(() => writer.close())
      .catch(() => undefined);
    const out = await drain(transform.readable, maxBytes);
    await written;
    return out;
  } catch {
    return null;
  }
}

/** JSON bytes to a payload string. Falls back to uncompressed when the API is missing. */
export async function packBytes(bytes: Uint8Array): Promise<string> {
  const deflated = await pipe("CompressionStream", bytes, MAX_INFLATED_BYTES);
  if (deflated === null) return FLAG_PLAIN + bytesToBase64Url(bytes);
  return FLAG_DEFLATE + bytesToBase64Url(deflated);
}

/** Payload string back to JSON bytes, or null for anything malformed. */
export async function unpackPayload(payload: string): Promise<Uint8Array | null> {
  const flag = payload.slice(0, 1);
  const body = payload.slice(1);
  if (flag !== FLAG_DEFLATE && flag !== FLAG_PLAIN) return null;
  const bytes = base64UrlToBytes(body);
  if (bytes === null) return null;
  if (flag === FLAG_PLAIN) return bytes.length <= MAX_INFLATED_BYTES ? bytes : null;
  return pipe("DecompressionStream", bytes, MAX_INFLATED_BYTES);
}
