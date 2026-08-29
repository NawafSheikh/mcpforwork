/**
 * Verifying the bridge's hello (mcpforwork-bridge/docs/CONTRACT.md).
 *
 * The bridge signs `{v, f, p}` over its version, its fingerprint and one line per pack,
 * so a page can tell that this fingerprint really offered this pack list. Change a pack
 * on the wire and the signature fails.
 *
 * Ed25519 in WebCrypto is not everywhere yet. A browser that cannot verify is not a
 * reason to refuse a robot on the visitor's own machine, so an unverifiable hello is
 * marked `unverified` and shown as such; only a signature that is present and wrong is
 * `failed`, and the session refuses that one.
 */

import type { BridgeHello, BridgePack } from "./bridge";

export type IdentityVerdict = "verified" | "unverified" | "failed";

/** Exactly the bytes the bridge signed. Any difference here reads as a bad signature. */
export function helloPayload(
  version: string,
  fingerprint: string,
  packs: readonly BridgePack[],
): string {
  return JSON.stringify({
    v: version,
    f: fingerprint,
    p: packs.map((pack) => `${pack.id}:${pack.risk}:${pack.tools.length}`),
  });
}

/** ArrayBuffer rather than a view, which is what SubtleCrypto wants either way. */
function fromBase64(value: string): ArrayBuffer | null {
  try {
    const binary = globalThis.atob(value);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let index = 0; index < binary.length; index += 1) view[index] = binary.charCodeAt(index);
    return buffer;
  } catch {
    return null;
  }
}

function utf8(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  const buffer = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(buffer).set(encoded);
  return buffer;
}

function subtle(): SubtleCrypto | null {
  const api = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  return api ?? null;
}

/**
 * "verified" when the signature checks out, "failed" when it is present and wrong, and
 * "unverified" when this browser has no Ed25519 or the hello carries no identity at all.
 */
export async function verifyHello(hello: BridgeHello): Promise<IdentityVerdict> {
  const identity = hello.identity;
  if (identity === undefined) return "unverified";
  const api = subtle();
  const key = fromBase64(identity.publicKey);
  const signature = fromBase64(identity.signature);
  if (api === null || key === null || signature === null) return "unverified";
  const payload = utf8(helloPayload(hello.version, identity.fingerprint, hello.packs));
  try {
    const publicKey = await api.importKey("spki", key, { name: "Ed25519" }, false, ["verify"]);
    const ok = await api.verify("Ed25519", publicKey, signature, payload);
    return ok ? "verified" : "failed";
  } catch {
    // No Ed25519 in this browser. Say so rather than pretending either way.
    return "unverified";
  }
}

export function verdictText(verdict: IdentityVerdict, fingerprint: string): string {
  if (verdict === "verified") return `Signed by ${fingerprint}`;
  if (verdict === "failed") return "The bridge signature did not check out. Nothing was registered.";
  return `${fingerprint} (this browser cannot check the signature)`;
}
