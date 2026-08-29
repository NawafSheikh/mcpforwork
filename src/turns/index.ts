/**
 * Public surface of the turn model (docs/TURNS.md): claims, versions and the gate every
 * agent write passes through. React free on purpose, so a tool handler can import it
 * without pulling a view in; the badges live in src/turns/ui.
 *
 * Nothing here is a lock and nothing here asks a human for permission. A claim is taken
 * automatically by whoever writes and is information for everybody else; a write that
 * lands on top of a fresh change is merged with the board rather than blocked, and only
 * a genuine collision on the same field is handed back to be read again.
 */

export {
  AGENT_FALLBACK,
  CLAIM_KINDS,
  claimAge,
  claimKey,
  claimOn,
  claimsLine,
  clockTime,
  describeClaimTarget,
  dropClaim,
  holdClaim,
  isHolder,
  isLive,
  liveClaims,
  pruneClaims,
  refreshClaim,
  workingOnText,
} from "./claims";
export type { HoldInput } from "./claims";

export {
  agoText,
  changedAtText,
  isStale,
  lastWriterOf,
  markWrite,
  objectUpdatedAt,
  readToolFor,
  recentWriter,
  writerName,
} from "./versions";
export type { WriterInput } from "./versions";

export { listNames, mergeParts } from "./merge";
export type { MergeParts, MergeResult } from "./merge";

export {
  FINISHING_TOOLS,
  VERSIONED_TOOLS,
  openTurn,
  readClaimTarget,
  settleTurn,
  writeTarget,
} from "./gate";
export type { GateOutcome, TurnDecision } from "./gate";

export { heldByMe, humanWrite, personRelease } from "./human";

export {
  TURN_READ_ONLY_TOOLS,
  TURN_TOOL_NAMES,
  TURN_UNTRUSTED_CONTENT_TOOLS,
  turnHandlers,
  turnJsonSchemas,
  turnToolDescriptions,
  turnToolSchemas,
} from "./tools";
export type { TurnHandler, TurnHandlerResult, TurnToolName } from "./tools";
