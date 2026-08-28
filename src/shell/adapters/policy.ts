/**
 * ADAPTER: policy description and diffing. Wired to src/policy (A3).
 * The UI only ever sees strings and a tone from here.
 */
import { describePolicy, diffPolicy } from "../../policy";
import type { Policy } from "../../types";

export type DiffTone = "added" | "removed" | "changed";

export interface DiffLine {
  readonly tone: DiffTone;
  readonly text: string;
}

function toneOf(line: string): DiffTone {
  if (line.includes(" added: ")) return "added";
  if (line.includes(" removed: ")) return "removed";
  return "changed";
}

/** Human readable diff between the saved policy and the edited one. */
export function diffPolicyLines(before: Policy, after: Policy): readonly DiffLine[] {
  return diffPolicy(before, after).map((text) => ({ tone: toneOf(text), text }));
}

/** One paragraph describing what a policy allows. */
export function describePolicyText(policy: Policy): string {
  return describePolicy(policy);
}
