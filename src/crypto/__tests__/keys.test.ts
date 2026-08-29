/**
 * Key material, the fingerprint people read aloud, and the fragment the key rides in.
 *
 * The fragment tests matter more than they look: a room key and a "#share=" snapshot have
 * to survive in the same hash in either order, because the app writes them from two places
 * that do not know about each other.
 */
import { describe, expect, it } from "vitest";
import {
  FINGERPRINT_CHARS,
  deriveRoomKey,
  fingerprint,
  generateRoomSecret,
  isRoomSecret,
  readSecretFromFragment,
  writeSecretToFragment,
} from "../keys";
import { parseFragment } from "../fragment";

const SLUG = "abc123xyz9";
/** A real share payload is unpadded base64url, exactly like this one. */
const SHARE = "0eyJ2IjoxLCJjYXRlZ29yaWVzIjpbXX0";

describe("generateRoomSecret", () => {
  it("is 32 random bytes as unpadded base64url", () => {
    const secret = generateRoomSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isRoomSecret(secret)).toBe(true);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateRoomSecret()));
    expect(seen.size).toBe(500);
  });

  it("rejects things that are not secrets", () => {
    for (const bad of ["", "short", "not base64url!!", null, 7, undefined, "a".repeat(200)]) {
      expect(isRoomSecret(bad)).toBe(false);
    }
  });
});

describe("deriveRoomKey", () => {
  it("gives a non-extractable AES-GCM 256 key", async () => {
    const key = await deriveRoomKey(generateRoomSecret(), SLUG);
    expect(key.type).toBe("secret");
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
    expect([...key.usages].sort()).toEqual(["decrypt", "encrypt"]);
  });

  it("refuses to hand the bytes back, so no script on the page can leak the key", async () => {
    const key = await deriveRoomKey(generateRoomSecret(), SLUG);
    await expect(globalThis.crypto.subtle.exportKey("raw", key)).rejects.toBeTruthy();
  });

  it("refuses a secret that is not one", async () => {
    await expect(deriveRoomKey("nope", SLUG)).rejects.toThrow(/valid secret/);
  });
});

describe("fingerprint", () => {
  it("is eight stable hex characters", async () => {
    const secret = generateRoomSecret();
    const first = await fingerprint(secret);
    const second = await fingerprint(secret);
    expect(first).toMatch(/^[0-9a-f]{8}$/);
    expect(first).toHaveLength(FINGERPRINT_CHARS);
    expect(second).toBe(first);
  });

  it("is a known value for a known secret, so a change to the derivation is loud", async () => {
    // Computed independently of this module, with node:crypto rather than Web Crypto:
    //   node --eval "process.stdout.write(require('node:crypto').createHash('sha256')
    //     .update('mfw-room-fp|v1|' + 'A'.repeat(43), 'utf8').digest('hex').slice(0, 8))"
    expect(await fingerprint("A".repeat(43))).toBe("adbd32c5");
  });

  it("differs between secrets", async () => {
    const marks = await Promise.all([generateRoomSecret(), generateRoomSecret()].map(fingerprint));
    expect(marks[0]).not.toBe(marks[1]);
  });
});

describe("the key in the fragment", () => {
  const secret = generateRoomSecret();

  it("reads k whether it comes before or after share", () => {
    expect(readSecretFromFragment(`#k=${secret}&share=${SHARE}`)).toBe(secret);
    expect(readSecretFromFragment(`#share=${SHARE}&k=${secret}`)).toBe(secret);
    expect(readSecretFromFragment(`k=${secret}`)).toBe(secret);
  });

  it("leaves the share payload byte for byte alone when it writes the key in", () => {
    const hash = writeSecretToFragment(`#share=${SHARE}`, secret);
    expect(hash).toBe(`#share=${SHARE}&k=${secret}`);
    expect(new URLSearchParams(hash.slice(1)).get("share")).toBe(SHARE);
    expect(readSecretFromFragment(hash)).toBe(secret);
  });

  it("replaces an existing key instead of stacking a second one", () => {
    const next = generateRoomSecret();
    const hash = writeSecretToFragment(`#k=${secret}&share=${SHARE}`, next);
    expect(parseFragment(hash).filter((p) => p.key === "k")).toHaveLength(1);
    expect(readSecretFromFragment(hash)).toBe(next);
    expect(new URLSearchParams(hash.slice(1)).get("share")).toBe(SHARE);
  });

  it("returns null for a hash with no key, or a key that is junk", () => {
    expect(readSecretFromFragment("")).toBeNull();
    expect(readSecretFromFragment("#")).toBeNull();
    expect(readSecretFromFragment(`#share=${SHARE}`)).toBeNull();
    expect(readSecretFromFragment("#k=")).toBeNull();
    expect(readSecretFromFragment("#k=not-a-secret")).toBeNull();
  });
});
