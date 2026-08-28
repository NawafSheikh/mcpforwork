/**
 * Policy engine barrel. docs/TOOLS.md "Policy semantics" is the specification.
 */

export {
  describePolicy,
  diffPolicy,
  evaluateDraft,
  fieldValue,
  thresholdClause,
} from "./engine";
export type {
  DraftCandidate,
  DraftEvaluation,
  DraftVerdict,
  RunContext,
} from "./engine";
