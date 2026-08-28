/**
 * Masking is the entry. If any of these fail, a real person's data reached the agent.
 */
import { describe, expect, it } from "vitest";
import {
  EMAIL_MASK,
  TEXT_MASK,
  cellHasEmail,
  looksLikeEmail,
  magnitudeBucket,
  maskDate,
  maskLabel,
  maskSample,
} from "../mask";
import { DATASET_LIMITS } from "../types";

const ADDRESSES = [
  "alice@example.com",
  "Alice.Smith+invoices@sub.corp.co.uk",
  "  BOB@EXAMPLE.IO  ",
  "contact me on carol@team.dev please",
  "\"dave@example.com\"",
];

const NOT_ADDRESSES = ["user @ example.com", "@handle", "5@10", "a@b", "plain text", "@"];

describe("email detection", () => {
  it.each(ADDRESSES)("treats %s as an address", (value) => {
    expect(looksLikeEmail(value)).toBe(true);
    expect(maskSample(value)).toBe(EMAIL_MASK);
    expect(maskLabel(value)).toBe(EMAIL_MASK);
  });

  it.each(NOT_ADDRESSES)("does not fire on %s", (value) => {
    expect(looksLikeEmail(value)).toBe(false);
  });

  it("only claims a cell holds an address when it is a string", () => {
    expect(cellHasEmail("a@b.com")).toBe(true);
    expect(cellHasEmail(42)).toBe(false);
    expect(cellHasEmail(null)).toBe(false);
    expect(cellHasEmail(true)).toBe(false);
  });

  it("never lets the local part survive", () => {
    for (const address of ADDRESSES) {
      const masked = maskLabel(address);
      expect(masked).not.toContain("alice");
      expect(masked).not.toContain("Alice");
      expect(masked).not.toContain("bob");
      expect(masked).not.toContain("carol");
      expect(masked).not.toContain("dave");
    }
  });
});

describe("magnitude buckets", () => {
  const cases: readonly (readonly [number, string])[] = [
    [0, "~0"],
    [1234, "~1.2k"],
    [-4500, "~-4.5k"],
    [1_500_000, "~1.5m"],
    [2_400_000_000, "~2.4b"],
    [87, "~87"],
    [0.045, "~0.045"],
    [Number.NaN, "n/a"],
    [Number.POSITIVE_INFINITY, "n/a"],
  ];

  it.each(cases)("buckets %s as %s", (value, expected) => {
    expect(magnitudeBucket(value)).toBe(expected);
  });

  it("never returns the exact figure for a salary sized number", () => {
    expect(magnitudeBucket(84_217)).toBe("~84k");
    expect(magnitudeBucket(84_217)).not.toContain("217");
  });
});

describe("sample masking", () => {
  it("replaces any other string with a constant, so nothing is inferable", () => {
    expect(maskSample("Alice Smith")).toBe(TEXT_MASK);
    expect(maskSample("Confidential board memo Q3")).toBe(TEXT_MASK);
    expect(maskSample("Alice Smith")).toBe(maskSample("Zebulon Q"));
  });

  it("keeps blanks visibly blank", () => {
    expect(maskSample(null)).toBe("");
    expect(maskSample("   ")).toBe("");
  });

  it("keeps booleans, which carry nothing", () => {
    expect(maskSample(true)).toBe("true");
    expect(maskSample(false)).toBe("false");
  });

  it("drops the day from a date but keeps the month", () => {
    expect(maskSample("2026-08-27", "date")).toBe("2026-08-…");
    expect(maskDate("2026-8-3")).toBe("2026-08-…");
    expect(maskDate("not a date")).toBe(TEXT_MASK);
  });
});

describe("category labels", () => {
  it("keeps a short category readable, because a chart needs it", () => {
    expect(maskLabel("EMEA")).toBe("EMEA");
    expect(maskLabel(12)).toBe("12");
  });

  it("cuts a long value to the label cap", () => {
    const long = "x".repeat(200);
    const masked = maskLabel(long);
    expect(masked.length).toBe(DATASET_LIMITS.labelChars);
    expect(masked.endsWith("…")).toBe(true);
  });

  it("names a blank rather than showing an empty axis label", () => {
    expect(maskLabel("")).toBe("(blank)");
    expect(maskLabel(null)).toBe("(blank)");
  });
});
