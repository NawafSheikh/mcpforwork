/**
 * Open for you: the three things that are actually waiting on this person. Requests
 * addressed to them by name, drafts policy held for a human, and the objects their own
 * name is on. Every row is a link to the place that answers it.
 */
import { ANY_ONE, openFeedback, useDisplayName } from "../../feedback";
import { describeClaimTarget } from "../../turns";
import type { Claim, Feedback, Workspace } from "../../types";
import { useWorkspace } from "../context";
import { OVERVIEW, REQUESTS, type Place } from "../lib/places";
import { useNav } from "../nav";

const MONITORS: Place = { kind: "monitors" };

/** Where the object a claim names actually lives. */
function placeOfClaim(claim: Claim, workspace: Workspace): Place {
  if (claim.target.kind === "overview") return OVERVIEW;
  if (claim.target.kind === "monitor") return MONITORS;
  if (claim.target.kind === "note") return REQUESTS;
  return workspace.categories[claim.target.id] === undefined
    ? OVERVIEW
    : { kind: "category", name: claim.target.id };
}

interface HeldRow {
  readonly text: string;
  readonly place: Place;
}

function forMe(item: Feedback, me: string): boolean {
  if (item.target.kind !== "person") return false;
  const to = item.target.id.trim().toLowerCase();
  return to === ANY_ONE || to === me.trim().toLowerCase();
}

function myRequests(workspace: Workspace, me: string): readonly Feedback[] {
  return openFeedback(workspace).filter((item) => forMe(item, me));
}

function myClaims(workspace: Workspace, me: string): readonly HeldRow[] {
  return Object.values(workspace.claims ?? {})
    .filter((claim) => claim.holderKind === "person")
    .filter((claim) => claim.holder.trim().toLowerCase() === me.trim().toLowerCase())
    .map((claim) => ({
      text: `You are working on ${describeClaimTarget(claim.target)}`,
      place: placeOfClaim(claim, workspace),
    }));
}

function Row({ text, onOpen }: { readonly text: string; readonly onOpen: () => void }): JSX.Element {
  return (
    <li>
      <button type="button" className="mfw-open__row" onClick={onOpen}>
        {text}
      </button>
    </li>
  );
}

export function OpenForYou(): JSX.Element {
  const workspace = useWorkspace();
  const me = useDisplayName();
  const { goTo } = useNav();

  const requests = myRequests(workspace, me);
  const held = Object.values(workspace.drafts).filter((draft) => draft.status === "held");
  const claims = myClaims(workspace, me);
  const empty = requests.length === 0 && held.length === 0 && claims.length === 0;

  return (
    <section className="mfw-rail__block" aria-label="Open for you">
      <h2 className="mfw-rail__title">Open for you</h2>
      {empty ? (
        <p className="mfw-rail__note">Nothing is addressed to you right now.</p>
      ) : (
        <ul className="mfw-open">
          {requests.map((item) => (
            <Row key={item.id} text={item.text} onOpen={() => goTo(REQUESTS)} />
          ))}
          {held.map((draft) => (
            <Row
              key={draft.id}
              text={`Held for you: ${draft.target} \u00b7 ${draft.summary}`}
              onOpen={() => goTo(MONITORS)}
            />
          ))}
          {claims.map((row) => (
            <Row key={row.text} text={row.text} onOpen={() => goTo(row.place)} />
          ))}
        </ul>
      )}
    </section>
  );
}
