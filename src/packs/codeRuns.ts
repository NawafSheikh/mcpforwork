/**
 * What ran on somebody's machine, so the page can show it.
 *
 * A `code.run` event arrives from a local bridge carrying the code, what it printed and,
 * when the script drew one, a picture. Nothing here is trusted: the whole record was
 * produced by a script somebody else's agent wrote, so every field is checked and capped,
 * and the picture is accepted only as a raster data URL. An SVG or an HTML data URL is a
 * thing that runs; a PNG is pixels. The bridge already refuses the first kind, and this
 * refuses it again, because two places saying no is the point of a boundary.
 */

const KEEP = 12;

export const RUN_LIMITS = {
  codeChars: 4_000,
  outputChars: 4_000,
  whyChars: 200,
  callerChars: 40,
  /** A data URL is about a third larger than the file the bridge capped. */
  artifactChars: 1_400_000,
} as const;

/** Raster only. The list is the allowance, not a filter over a larger one. */
const IMAGE_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export interface CodeRun {
  readonly id: string;
  readonly runtime: string;
  readonly caller: string;
  readonly why: string;
  readonly code: string;
  readonly output: string;
  /** A data URL for a raster image, or null. Never anything that executes. */
  readonly artifact: string | null;
  readonly ok: boolean;
  readonly ms: number;
  readonly at: string;
}

function text(value: unknown, max: number, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

/** A picture, or null and no explanation: a refused artifact is simply not shown. */
export function coerceArtifact(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length > RUN_LIMITS.artifactChars) return null;
  return IMAGE_URL.test(value) ? value : null;
}

export function coerceRun(payload: unknown, at: string = new Date().toISOString()): CodeRun | null {
  if (typeof payload !== "object" || payload === null) return null;
  const raw = payload as Record<string, unknown>;
  const code = text(raw.code, RUN_LIMITS.codeChars);
  if (code.trim().length === 0) return null;
  const stamp = text(raw.at, 40) || at;
  return {
    id: `run-${stamp}-${code.length}`,
    runtime: text(raw.runtime, 12, "code"),
    caller: text(raw.caller, RUN_LIMITS.callerChars, "an agent"),
    why: text(raw.why, RUN_LIMITS.whyChars),
    code,
    output: text(raw.output, RUN_LIMITS.outputChars),
    artifact: coerceArtifact(raw.artifact),
    ok: raw.ok !== false,
    ms: typeof raw.ms === "number" && Number.isFinite(raw.ms) ? Math.max(0, Math.round(raw.ms)) : 0,
    at: stamp,
  };
}

const listeners = new Set<() => void>();
let runs: readonly CodeRun[] = [];

/** Newest first, which is the order a person reads them in. */
export function codeRuns(): readonly CodeRun[] {
  return runs;
}

export function recordRun(payload: unknown): CodeRun | null {
  const run = coerceRun(payload);
  if (run === null) return null;
  runs = [run, ...runs.filter((item) => item.id !== run.id)].slice(0, KEEP);
  for (const listener of [...listeners]) listener();
  return run;
}

export function subscribeRuns(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearRuns(): void {
  runs = [];
  for (const listener of [...listeners]) listener();
}
