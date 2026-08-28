/** Persistent agent activity rail, wide screens only (CSS hides it when narrow). */
import type { AuditEvent } from "../types";
import { useWorkspace } from "./context";
import { actorIcon, describeToolEvent, formatRelative } from "./lib/format";
import { RAIL_EVENT_COUNT } from "./lib/constants";

/** Sub-agents name themselves; anything that did not is plain ChatGPT. */
export function callerName(event: AuditEvent): string {
  const caller = event.caller?.trim();
  return caller && caller.length > 0 ? caller : "ChatGPT";
}

export function AgentRail(): JSX.Element {
  const workspace = useWorkspace();
  const events = [...workspace.audit].reverse().slice(0, RAIL_EVENT_COUNT);

  return (
    <aside className="mfw-rail" aria-label="Agent activity">
      <h2 className="mfw-rail-title">Agent activity</h2>
      {events.length === 0 ? (
        <p className="mfw-muted mfw-rail-empty">
          Nothing yet. Tool calls from ChatGPT land here the moment they arrive.
        </p>
      ) : (
        <ol className="mfw-rail-list">
          {events.map((event) => (
            <li className="mfw-rail-item" key={event.id}>
              <span className={`mfw-actor mfw-actor-${event.actor}`}>{actorIcon(event.actor)}</span>
              <span className="mfw-rail-body">
                <span className="mfw-rail-text">{describeToolEvent(event)}</span>
                <span className="mfw-rail-meta">
                  <span className="mfw-chip mfw-caller">{callerName(event)}</span>
                  {` ${formatRelative(event.at)}`}
                  {event.ok ? "" : " | failed"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
