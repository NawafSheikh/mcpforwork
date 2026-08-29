/**
 * Public surface of the feedback module. Other modules import from here, never from
 * the files: the store helpers for anything that holds a Workspace, FeedbackBox for
 * anything that renders one, RoomRequests and NameChip for the room-wide thread.
 */

export { FeedbackBox } from "./ui/FeedbackBox";
export type { FeedbackBoxProps } from "./ui/FeedbackBox";
export { RoomRequests } from "./ui/RoomRequests";
export { NameChip, useDisplayName } from "./ui/NameChip";
export type { NameChipProps } from "./ui/NameChip";
export { authorLabel, targetLabel } from "./ui/notes";
export {
  DEFAULT_NAME,
  MAX_NAME_CHARS,
  NAME_KEY,
  displayName,
  resetNameCache,
  setDisplayName,
  subscribeName,
} from "./identity";
export {
  ADDRESSED_KINDS,
  ANY_ONE,
  ROOM_TARGET,
  addFeedback,
  addressedFeedback,
  addressedTo,
  agentAddressedCount,
  describeTarget,
  isAgentAddressed,
  isFor,
  isOpen,
  listFeedback,
  openFeedback,
  openFeedbackCount,
  openFeedbackFor,
  resolveFeedback,
  resolvedFeedback,
  sameTarget,
  FEEDBACK_TOOL,
} from "./store";
export type { AddFeedbackInput, ResolveFeedbackInput } from "./store";
