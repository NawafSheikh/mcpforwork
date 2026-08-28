/**
 * Handler shape the WebMCP registry calls. Kept local so src/monitors does not
 * depend on the registry module landing first; the signature is the contract.
 * Inputs arrive already validated by the zod schemas in src/webmcp/schemas.ts,
 * so the readers below are a second line of defence, not the only one.
 */

import type { Workspace } from "../types";

export interface HandlerResult {
  /** Omitted when the call changed nothing (read tools, refusals, errors). */
  readonly next?: Workspace;
  readonly result: string;
}

export type HandlerFn = (input: unknown, ws: Workspace) => HandlerResult;

export function asRecord(input: unknown): Readonly<Record<string, unknown>> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

export function readString(input: unknown, key: string): string | undefined {
  const value = asRecord(input)[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function readNumber(input: unknown, key: string): number | undefined {
  const value = asRecord(input)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readArray(input: unknown, key: string): readonly unknown[] {
  const value = asRecord(input)[key];
  return Array.isArray(value) ? value : [];
}

export function readStrings(input: unknown, key: string): readonly string[] {
  return readArray(input, key).filter(
    (entry): entry is string => typeof entry === "string",
  );
}
