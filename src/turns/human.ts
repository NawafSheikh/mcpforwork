/**
 * The person's side of a turn (docs/TURNS.md).
 *
 * A person never asks for a turn and is never refused one. Editing a chart, saving a
 * policy or deciding a draft takes the claim for that person automatically, exactly the
 * way an agent's write does, and puts their name on the object as the last writer. The
 * agent finds out on its next call, in a sentence, and keeps working.
 */
import type { ClaimTarget, Workspace } from "../types";
import { claimOn, dropClaim, holdClaim, isHolder } from "./claims";
import { markWrite } from "./versions";

/** Fold a human edit into the board: the badge and the last writer both become theirs. */
export function humanWrite(
  ws: Workspace,
  target: ClaimTarget,
  person: string,
  now: Date = new Date(),
): Workspace {
  const claimed = holdClaim(ws, { target, holder: person, holderKind: "person" }, now);
  return markWrite(claimed, target, { by: person, byKind: "person" }, now);
}

/** The person is done with this object, so the badge comes off. Their own turn only. */
export function personRelease(
  ws: Workspace,
  target: ClaimTarget,
  person: string,
  now: Date = new Date(),
): Workspace {
  const claim = claimOn(ws, target, now);
  if (claim === null || !isHolder(claim, person)) return ws;
  return dropClaim(ws, target, now);
}

/** True when this browser's visitor is the one whose name is on the card. */
export function heldByMe(
  ws: Workspace,
  target: ClaimTarget,
  person: string,
  now: Date = new Date(),
): boolean {
  const claim = claimOn(ws, target, now);
  return claim !== null && claim.holderKind === "person" && isHolder(claim, person);
}
