/**
 * What the page will accept from a script somebody else's agent wrote.
 *
 * The bridge already refuses anything but a raster image. This refuses it again, because
 * a boundary that only one side enforces is not a boundary: a hostile or simply broken
 * bridge must not be able to put a thing that executes into an img tag.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { RUN_LIMITS, clearRuns, codeRuns, coerceArtifact, coerceRun, recordRun } from "../codeRuns";

const base = {
  runtime: "python",
  caller: "Ana's Claude",
  code: "print('4 offers under budget')",
  output: "4 offers under budget",
  ok: true,
  ms: 42,
  at: "2026-08-30T10:00:00.000Z",
};

describe("a run arriving from a bridge", () => {
  beforeEach(() => clearRuns());

  it("keeps the code and the output together", () => {
    const run = coerceRun(base);
    expect(run?.code).toBe("print('4 offers under budget')");
    expect(run?.output).toBe("4 offers under budget");
    expect(run?.caller).toBe("Ana's Claude");
  });

  it("drops a record with no code, because there is nothing to show", () => {
    expect(coerceRun({ ...base, code: "   " })).toBeNull();
    expect(coerceRun(null)).toBeNull();
    expect(coerceRun("print(1)")).toBeNull();
  });

  it("caps code and output rather than rendering whatever arrived", () => {
    const run = coerceRun({ ...base, code: "x".repeat(99_999), output: "y".repeat(99_999) });
    expect(run?.code.length).toBe(RUN_LIMITS.codeChars);
    expect(run?.output.length).toBe(RUN_LIMITS.outputChars);
  });

  it("names the caller as an agent when the bridge did not say who", () => {
    expect(coerceRun({ ...base, caller: 42 })?.caller).toBe("an agent");
  });
});

describe("what may be put into an img tag", () => {
  it("takes a raster data URL", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(coerceArtifact(png)).toBe(png);
    expect(coerceArtifact("data:image/jpeg;base64,AAAA")).not.toBeNull();
    expect(coerceArtifact("data:image/webp;base64,AAAA")).not.toBeNull();
  });

  it("refuses an SVG data URL, which is a script container and not a picture", () => {
    expect(coerceArtifact("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBeNull();
    expect(coerceArtifact("data:image/svg+xml,<svg onload=alert(1)>")).toBeNull();
  });

  it("refuses anything else that could execute or navigate", () => {
    expect(coerceArtifact("data:text/html;base64,PGgxPmhpPC9oMT4=")).toBeNull();
    expect(coerceArtifact("javascript:alert(1)")).toBeNull();
    expect(coerceArtifact("https://example.com/chart.png")).toBeNull();
    expect(coerceArtifact("data:image/png;base64,<script>")).toBeNull();
  });

  it("refuses one that is too large to be a capped artifact", () => {
    expect(coerceArtifact(`data:image/png;base64,${"A".repeat(RUN_LIMITS.artifactChars)}`)).toBeNull();
  });
});

describe("the list the page draws", () => {
  beforeEach(() => clearRuns());

  it("puts the newest first and keeps a bounded number", () => {
    for (let i = 0; i < 20; i += 1) {
      recordRun({ ...base, code: `print(${i})`, at: `2026-08-30T10:00:${String(i).padStart(2, "0")}.000Z` });
    }
    const runs = codeRuns();
    expect(runs.length).toBeLessThanOrEqual(12);
    expect(runs[0]?.code).toBe("print(19)");
  });

  it("ignores a record it could not read at all", () => {
    expect(recordRun({ nonsense: true })).toBeNull();
    expect(codeRuns()).toHaveLength(0);
  });
});
