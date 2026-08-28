/**
 * Public surface of the feedback module. Other modules import from here, never from
 * the files: the store helpers for anything that holds a Workspace, FeedbackBox for
 * anything that renders one.
 */

export { FeedbackBox } from "./ui/FeedbackBox";
export type { FeedbackBoxProps } from "./ui/FeedbackBox";
export {
  addFeedback,
  isOpen,
  listFeedback,
  openFeedback,
  openFeedbackCount,
  resolveFeedback,
  resolvedFeedback,
  sameTarget,
  FEEDBACK_TOOL,
} from "./store";
export type { AddFeedbackInput, ResolveFeedbackInput } from "./store";
