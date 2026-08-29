/**
 * Requests: the room thread of all four kinds, full width, with the composer that can
 * address any of them. Open first, resolved folded away, exactly as RoomRequests paints
 * it; this page adds the picker and the width.
 */
import { RoomRequests } from "../../feedback";
import { RequestComposer } from "./RequestComposer";

const LEAD =
  "Person to person, person to agent, agent to person, agent to agent. One thread, so both sides watch the same queue.";

export function RequestsPage(): JSX.Element {
  return (
    <div className="mfw-page">
      <section className="mfw-card">
        <h2 className="mfw-page__title">Requests</h2>
        <p className="mfw-muted">{LEAD}</p>
        <RequestComposer />
      </section>
      <section className="mfw-card">
        <RoomRequests />
      </section>
    </div>
  );
}
