/**
 * The turn model's two pieces of UI, both read-only: a badge on a card and a line in the
 * header. Kept out of src/turns/index.ts so a tool handler never pulls React in.
 */
export { ClaimBadge } from "./ClaimBadge";
export type { ClaimBadgeProps } from "./ClaimBadge";
export { ClaimsChip, useClaimsLine } from "./ClaimsChip";
