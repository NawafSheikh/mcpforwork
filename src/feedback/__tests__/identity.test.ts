/** The display name: remembered, capped, guarded, and never empty. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NAME,
  MAX_NAME_CHARS,
  NAME_KEY,
  displayName,
  resetNameCache,
  setDisplayName,
  subscribeName,
} from "../identity";

beforeEach(() => {
  globalThis.localStorage?.clear();
  resetNameCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.localStorage?.clear();
  resetNameCache();
});

describe("displayName", () => {
  it("falls back to Someone when nothing was ever stored", () => {
    expect(displayName()).toBe(DEFAULT_NAME);
  });

  it("reads what a previous session stored", () => {
    globalThis.localStorage.setItem(NAME_KEY, "Maria");
    expect(displayName()).toBe("Maria");
  });

  it("stores a trimmed name and hands back what it kept", () => {
    expect(setDisplayName("  Nawaf  ")).toBe("Nawaf");
    expect(globalThis.localStorage.getItem(NAME_KEY)).toBe("Nawaf");
    expect(displayName()).toBe("Nawaf");
  });

  it("caps a very long name instead of refusing it", () => {
    const kept = setDisplayName("n".repeat(200));
    expect(kept).toHaveLength(MAX_NAME_CHARS);
  });

  it("treats a blank name as no name at all", () => {
    setDisplayName("Maria");
    expect(setDisplayName("   ")).toBe(DEFAULT_NAME);
  });

  it("survives storage that throws, in memory", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(setDisplayName("Maria")).toBe("Maria");
    expect(displayName()).toBe("Maria");
  });

  it("returns the default when reading throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(displayName()).toBe(DEFAULT_NAME);
  });

  it("tells subscribers about a rename until they unsubscribe", () => {
    let calls = 0;
    const stop = subscribeName(() => {
      calls += 1;
    });
    setDisplayName("Maria");
    stop();
    setDisplayName("Nawaf");
    expect(calls).toBe(1);
  });
});
