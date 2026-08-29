/**
 * The envelope: what actually crosses the relay.
 *
 * Every outgoing room message is JSON, sealed with AES-GCM under the room key, and the
 * relay sees { v, iv, ct, fp } and nothing else. A fresh 12 byte iv per message is not
 * optional with GCM: one repeated iv under one key leaks the xor of two plaintexts and
 * forges the tag, so the iv is generated at seal time and never derived or counted.
 *
 * The room slug goes into the additional data, taken from the local context and never
 * from the envelope, so a ciphertext lifted out of one room and replayed into another
 * fails the tag check. `open` returns null for every failure and never throws, because it
 * runs inside a socket callback where a throw would take the whole sync engine down.
 */
import { fromBase64url, toBase64url } from "./base64url";
import { fromUtf8, randomBytes, subtle, utf8 } from "./webcrypto";

export const ENVELOPE_VERSION = 1;
const IV_BYTES = 12;

export interface Envelope {
  readonly v: 1;
  /** base64url, 12 bytes, fresh for every message. */
  readonly iv: string;
  /** base64url ciphertext with the GCM tag appended, as WebCrypto returns it. */
  readonly ct: string;
  /** Room key fingerprint, so a peer on the wrong key is told that instead of "corrupt". */
  readonly fp: string;
}

/** What both ends know locally: never read out of the message being opened. */
export interface SealContext {
  readonly slug: string;
  readonly fp: string;
}

const NO_CONTEXT: SealContext = { slug: "", fp: "" };

function additionalData(context: SealContext) {
  return utf8(`mfw-room|v${ENVELOPE_VERSION}|${context.slug}`);
}

export function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Envelope>;
  return (
    candidate.v === ENVELOPE_VERSION &&
    typeof candidate.iv === "string" &&
    typeof candidate.ct === "string" &&
    typeof candidate.fp === "string"
  );
}

export async function seal(key: CryptoKey, payload: unknown, context: SealContext = NO_CONTEXT): Promise<Envelope> {
  const iv = randomBytes(IV_BYTES);
  const json = JSON.stringify(payload);
  const plain = utf8(json === undefined ? "null" : json);
  const sealed = await subtle().encrypt(
    { name: "AES-GCM", iv, additionalData: additionalData(context) },
    key,
    plain,
  );
  return { v: ENVELOPE_VERSION, iv: toBase64url(iv), ct: toBase64url(new Uint8Array(sealed)), fp: context.fp };
}

/**
 * null on a wrong key, a tampered byte, a foreign room, an old version or a shape that is
 * not an envelope at all. The caller counts the nulls and shows "N messages this browser
 * could not read"; it never gets to tell the difference, and neither does an attacker.
 */
export async function open(
  key: CryptoKey,
  envelope: unknown,
  context: SealContext = NO_CONTEXT,
): Promise<unknown | null> {
  if (!isEnvelope(envelope)) return null;
  if (context.fp.length > 0 && envelope.fp.length > 0 && envelope.fp !== context.fp) return null;
  const iv = fromBase64url(envelope.iv);
  const ct = fromBase64url(envelope.ct);
  if (iv === null || ct === null || iv.length !== IV_BYTES || ct.length === 0) return null;
  try {
    const plain = await subtle().decrypt(
      { name: "AES-GCM", iv, additionalData: additionalData(context) },
      key,
      ct,
    );
    return JSON.parse(fromUtf8(plain)) as unknown;
  } catch {
    return null;
  }
}
