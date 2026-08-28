/**
 * Where a human leaves a note for the agent on one dashboard or the overview.
 * The control itself is A6's FeedbackBox from src/feedback; this slot only picks
 * the target and takes it off the page in read only mode, because a shared
 * snapshot must never offer an input that writes to somebody else's workspace.
 */

import { FeedbackBox } from "../../../feedback";
import type { FeedbackTarget } from "../../../types";
import "./board.css";

export interface FeedbackSlotProps {
  readonly target: FeedbackTarget;
  /** Shared snapshots render the board with no way to write to it. */
  readonly readOnly?: boolean;
  readonly compact?: boolean;
}

export function FeedbackSlot({ target, readOnly = false, compact }: FeedbackSlotProps): JSX.Element | null {
  if (readOnly) return null;
  return <FeedbackBox target={target} compact={compact} />;
}
