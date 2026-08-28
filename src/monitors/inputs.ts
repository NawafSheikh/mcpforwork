/**
 * Defensive readers that turn already-zod-validated tool input into the domain
 * shapes the monitors use. Anything unrecognised is dropped, never guessed.
 */

import type { DraftCandidate } from "../policy/engine";
import type { Policy, Threshold, ThresholdOp } from "../types";
import {
  asRecord,
  readArray,
  readNumber,
  readString,
  readStrings,
} from "./handlerTypes";

const OPS: readonly ThresholdOp[] = ["gt", "gte", "lt", "lte", "eq"];

function readFields(
  entry: unknown,
): Readonly<Record<string, string | number>> | undefined {
  const raw = asRecord(entry)["fields"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const pairs = Object.entries(raw as Record<string, unknown>).filter(
    (pair): pair is [string, string | number] =>
      typeof pair[1] === "string" || typeof pair[1] === "number",
  );
  return pairs.length > 0 ? Object.fromEntries(pairs) : undefined;
}

export function readDrafts(input: unknown): readonly DraftCandidate[] {
  return readArray(input, "drafts").flatMap((entry) => {
    const kind = readString(entry, "kind");
    const target = readString(entry, "target");
    const summary = readString(entry, "summary");
    if (!kind || !target || !summary) {
      return [];
    }
    const amount = readNumber(entry, "amount");
    const fields = readFields(entry);
    return [
      {
        kind,
        target,
        summary,
        ...(amount !== undefined ? { amount } : {}),
        ...(fields !== undefined ? { fields } : {}),
      },
    ];
  });
}

function readThresholds(raw: unknown): readonly Threshold[] {
  return readArray(raw, "thresholds").flatMap((entry) => {
    const field = readString(entry, "field");
    const op = readString(entry, "op") as ThresholdOp | undefined;
    const value = readNumber(entry, "value");
    if (!field || !op || !OPS.includes(op) || value === undefined) {
      return [];
    }
    const label = readString(entry, "label");
    return [{ field, op, value, ...(label ? { label } : {}) }];
  });
}

/** Reads the `policy` member of a tool input. Undefined when it is unusable. */
export function readPolicy(input: unknown): Policy | undefined {
  const raw = asRecord(input)["policy"];
  const maxAutoActionsPerRun = readNumber(raw, "maxAutoActionsPerRun");
  if (maxAutoActionsPerRun === undefined || maxAutoActionsPerRun < 0) {
    return undefined;
  }
  const notes = readString(raw, "notes");
  return {
    maxAutoActionsPerRun: Math.floor(maxAutoActionsPerRun),
    thresholds: readThresholds(raw),
    allowlist: readStrings(raw, "allowlist"),
    denylist: readStrings(raw, "denylist"),
    requireHumanFor: readStrings(raw, "requireHumanFor"),
    ...(notes ? { notes } : {}),
  };
}
