/**
 * Regressions from the first live deployment (28 Aug 2026).
 *
 * All three failures below shipped green: the unit tests passed, the build passed, and the
 * room still did nothing in a real browser. These lock down the parts that were provably
 * wrong on the deployed site.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createSupabaseTransport } from "../supabase";
import { createWorkspaceStore } from "../../store";
import { roomStoreKey } from "../slug";
import type { RoomStatus } from "../types";

/** A socket that never opens, the way a CSP block behaves: constructed, then closed. */
class RefusedSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readyState = 3;
  constructor() {
    setTimeout(() => {
      this.onerror?.();
      this.onclose?.();
    }, 0);
  }
  send(): void {
    throw new Error("socket is closed");
  }
  close(): void {}
}

const tick = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe("a relay the browser refuses to connect to", () => {
  it("reports error rather than connecting forever, so the UI can tell the difference", async () => {
    const seen: RoomStatus[] = [];
    const transport = createSupabaseTransport(
      "abc123",
      { url: "https://demo.supabase.co", anonKey: "anon" },
      { socketFactory: () => new RefusedSocket() as unknown as WebSocket },
    );
    transport.onStatus((status) => seen.push(status));
    transport.connect();
    await tick(60);
    // First failure still reads as connecting; a second one is a refusal, not a wait.
    await tick(1400);
    await tick(2600);
    expect(seen).toContain("error");
    expect(transport.status()).toBe("error");
    transport.close();
  }, 10000);

  it("never throws out of send when the socket is not open", () => {
    const transport = createSupabaseTransport(
      "abc123",
      { url: "https://demo.supabase.co", anonKey: "anon" },
      { socketFactory: () => new RefusedSocket() as unknown as WebSocket },
    );
    transport.connect();
    expect(() => transport.send({ t: "bye", from: "c1", at: new Date().toISOString() })).not.toThrow();
    transport.close();
  });
});

describe("the room-scoped board survives a reload", () => {
  it("re-keys persistence when a room opens mid-session instead of copying once", async () => {
    const store = createWorkspaceStore({ mode: "local", persist: false });
    expect(store.key).toBe("mfw:workspace:local");
    await store.rekey(roomStoreKey("abc123"));
    expect(store.key).toBe("mfw:workspace:room:abc123");
    store.dispose();
  });

  it("is a no-op when the page already booted on that slug, so hydration is safe", async () => {
    const key = roomStoreKey("abc123");
    const store = createWorkspaceStore({ mode: "local", persist: false, key });
    await store.rekey(key);
    expect(store.key).toBe(key);
    store.dispose();
  });
});

describe("the deployed Content Security Policy", () => {
  const connectSrc = (text: string): string =>
    /connect-src ([^;"]*)/.exec(text)?.[1]?.trim() ?? "";

  /**
   * A wss: connection is not covered by an https: source in Chrome, so the room socket was
   * blocked on the live site while every test stayed green. Both copies of the policy have
   * to allow it: the meta element in index.html and the response header in vercel.json.
   */
  it("allows the realtime websocket in index.html and vercel.json", () => {
    for (const file of ["index.html", "vercel.json"]) {
      const policy = connectSrc(readFileSync(file, "utf8"));
      expect(policy, file).toContain("wss://*.supabase.co");
    }
  });
});
