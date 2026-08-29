/**
 * "Maria's agent is working on this", on the card it is true of.
 *
 * It is information and never a control: there is no button to take the object away, no
 * toggle to ask for it and nothing to press before editing. Whoever writes gets their name
 * here automatically, and it comes off when they finish or after ten quiet minutes.
 */
import type { ClaimTarget } from "../../types";
import { useWorkspace } from "../../shell/context";
import { claimAge, claimOn } from "../claims";
import "./claims.css";

const TITLE = "Whoever writes gets their name here. It blocks nobody: edit when you need to.";

export interface ClaimBadgeProps {
  readonly target: ClaimTarget;
}

export function ClaimBadge({ target }: ClaimBadgeProps): JSX.Element | null {
  const workspace = useWorkspace();
  const claim = claimOn(workspace, target);
  if (claim === null) return null;
  return (
    <span className={`mfw-claim mfw-claim-${claim.holderKind}`} title={TITLE}>
      <span className="mfw-claim-dot" aria-hidden="true" />
      {`${claim.holder} is working on this`}
      <span className="mfw-claim-age">{claimAge(claim)}</span>
    </span>
  );
}
