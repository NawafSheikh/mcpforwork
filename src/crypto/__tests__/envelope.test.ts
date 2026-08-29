/**
 * What the relay sees, and every way opening can fail.
 *
 * The failure tests all assert the same thing, `null`, because that is the contract: the
 * sync engine runs `open` inside a socket callback, where a throw would take down the
 * room, and a caller that could tell "wrong key" from "tampered" would be an oracle.
 */
import { describe, expect, it } from "vitest";
import { deriveRoomKey, fingerprint, generateRoomSecret } from "../keys";
import { ENVELOPE_VERSION, isEnvelope, open, seal, type SealContext } from "../envelope";

const ROOM_A = "abc123xyz9";
const ROOM_B = "zzz999aaa1";

/** A patch message shaped like the ones src/rooms/diff.ts produces. */
const PATCH = {
  t: "patch",
  from: "cabc123def456",
  at: "2026-08-29T10:00:00.000Z",
  patches: [{ kind: "category", key: "Invoices", value: { title: "Invoices" }, at: "2026-08-29T10:00:00.000Z", origin: "cabc123def456" }],
};

async function room(slug: string, secret = generateRoomSecret()): Promise<{ key: CryptoKey; context: SealContext; secret: string }> {
  const key = await deriveRoomKey(secret, slug);
  return { key, secret, context: { slug, fp: await fingerprint(secret) } };
}

describe("seal and open", () => {
  it("round trips a patch message", async () => {
    const a = await room(ROOM_A);
    const envelope = await seal(a.key, PATCH, a.context);
    expect(envelope.v).toBe(ENVELOPE_VERSION);
    expect(isEnvelope(envelope)).toBe(true);
    expect(await open(a.key, envelope, a.context)).toEqual(PATCH);
  });

  it("round trips the payload shapes JSON can carry", async () => {
    const a = await room(ROOM_A);
    for (const payload of [null, 0, "", "text", true, [], [1, "two"], { nested: { deep: [1, 2, 3] } }]) {
      expect(await open(a.key, await seal(a.key, payload, a.context), a.context)).toEqual(payload);
    }
  });

  it("shows the relay nothing but version, iv, ciphertext and fingerprint", async () => {
    const a = await room(ROOM_A);
    const envelope = await seal(a.key, { secretWord: "quarterly-layoffs" }, a.context);
    expect(Object.keys(envelope).sort()).toEqual(["ct", "fp", "iv", "v"]);
    expect(JSON.stringify(envelope)).not.toContain("quarterly-layoffs");
    expect(JSON.stringify(envelope)).not.toContain("secretWord");
    expect(JSON.stringify(envelope)).not.toContain(a.secret);
  });

  it("uses a fresh iv for every message, which GCM requires", async () => {
    const a = await room(ROOM_A);
    const ivs = new Set<string>();
    for (let i = 0; i < 200; i += 1) ivs.add((await seal(a.key, PATCH, a.context)).iv);
    expect(ivs.size).toBe(200);
  });
});

describe("open returns null instead of throwing", () => {
  it("on the wrong key, even when the envelope claims the right fingerprint", async () => {
    const a = await room(ROOM_A);
    const other = await room(ROOM_A);
    const envelope = await seal(a.key, PATCH, a.context);
    // Same context on both sides, so the cheap fingerprint check cannot be what rejects it.
    expect(await open(other.key, { ...envelope, fp: a.context.fp }, a.context)).toBeNull();
  });

  it("on a tampered ciphertext or a tampered iv", async () => {
    const a = await room(ROOM_A);
    const envelope = await seal(a.key, PATCH, a.context);
    const flip = (text: string): string => (text.startsWith("A") ? `B${text.slice(1)}` : `A${text.slice(1)}`);
    expect(await open(a.key, { ...envelope, ct: flip(envelope.ct) }, a.context)).toBeNull();
    expect(await open(a.key, { ...envelope, iv: flip(envelope.iv) }, a.context)).toBeNull();
    expect(await open(a.key, { ...envelope, ct: envelope.ct.slice(0, -4) }, a.context)).toBeNull();
  });

  it("when a ciphertext from one room is replayed into another", async () => {
    const secret = generateRoomSecret();
    const a = await room(ROOM_A, secret);
    const b = await room(ROOM_B, secret);
    const envelope = await seal(a.key, PATCH, a.context);
    // Same invite secret, different room: HKDF gave a different key.
    expect(await open(b.key, { ...envelope, fp: b.context.fp }, b.context)).toBeNull();
    // And with the right key but the wrong slug in the additional data, the tag still fails.
    expect(await open(a.key, envelope, { slug: ROOM_B, fp: a.context.fp })).toBeNull();
  });

  it("when the fingerprint says this browser is on a different key", async () => {
    const a = await room(ROOM_A);
    const envelope = await seal(a.key, PATCH, a.context);
    expect(await open(a.key, { ...envelope, fp: "deadbeef" }, a.context)).toBeNull();
  });

  it("on a version it does not know, or on something that is not an envelope", async () => {
    const a = await room(ROOM_A);
    const envelope = await seal(a.key, PATCH, a.context);
    expect(await open(a.key, { ...envelope, v: 2 }, a.context)).toBeNull();
    for (const junk of [null, undefined, 7, "text", [], {}, { v: 1, iv: "x" }, { ...envelope, v: 2 }]) {
      expect(isEnvelope(junk)).toBe(false);
      expect(await open(a.key, junk, a.context)).toBeNull();
    }
    // Right shape, unusable fields: isEnvelope passes and open still refuses.
    for (const broken of [{ ...envelope, ct: "!!!" }, { ...envelope, iv: "" }, { ...envelope, ct: "" }]) {
      expect(isEnvelope(broken)).toBe(true);
      expect(await open(a.key, broken, a.context)).toBeNull();
    }
  });
});

describe("cost", () => {
  /**
   * An order-of-magnitude smoke test, not a benchmark. Sealing a room message must stay
   * cheap enough that a busy board never notices it, and the failure this guards against
   * (a key derived per message, a synchronous fallback) is hundreds of times slower, not
   * twice. The ceiling is deliberately loose because the suite runs its jsdom
   * environments in parallel and this file is promised no core of its own: a tight
   * wall-clock bound here fails on a loaded machine and says nothing about the code.
   */
  it("seals a burst of messages without derailing the board", async () => {
    const a = await room(ROOM_A);
    const started = performance.now();
    for (let i = 0; i < 200; i += 1) await seal(a.key, { ...PATCH, n: i }, a.context);
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(10_000);
  }, 30_000);
});
