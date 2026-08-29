/**
 * "Maria's agent changed this 20 s ago", on the object it is true of.
 *
 * The audit rail is shared across a room, so a change made in somebody else's browser
 * lands here with their name on it the moment the patch arrives. It is information: it
 * never blocks an edit and it disappears on its own.
 */
import { agoText } from "../../turns";
import { useWorkspace } from "../context";
import { pulseFor } from "../lib/pulse";
import type { Place } from "../lib/places";

export function PulseChip({ place }: { readonly place: Place }): JSX.Element | null {
  const workspace = useWorkspace();
  const pulse = pulseFor(workspace, place);
  if (pulse === null) return null;
  return (
    <p className="mfw-pulse" key={pulse.eventId} role="status">
      <span className={`mfw-actor mfw-actor-${pulse.agent ? "agent" : "human"}`}>
        {pulse.agent ? "AI" : "You"}
      </span>
      {`${pulse.by} changed this ${agoText(pulse.at)} ago`}
    </p>
  );
}
