/** Activity: the audit rail, newest first, filterable by actor. */
import { useMemo, useState } from "react";
import type { Actor } from "../../types";
import { useWorkspace } from "../context";
import { actorIcon, formatClock, formatRelative } from "../lib/format";

type Filter = Actor | "all";

const FILTERS: readonly Filter[] = ["all", "agent", "human", "system"];

const FILTER_LABELS: Readonly<Record<Filter, string>> = {
  all: "Everything",
  agent: "ChatGPT",
  human: "You",
  system: "System",
};

export function ActivityTab(): JSX.Element {
  const workspace = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");

  const events = useMemo(() => {
    const newestFirst = [...workspace.audit].reverse();
    return filter === "all" ? newestFirst : newestFirst.filter((event) => event.actor === filter);
  }, [workspace.audit, filter]);

  return (
    <section className="mfw-card mfw-activity">
      <header className="mfw-activity-head">
        <h3>Activity</h3>
        <div className="mfw-filters" role="group" aria-label="Filter by actor">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              className={filter === value ? "mfw-filter mfw-filter-on" : "mfw-filter"}
              onClick={() => setFilter(value)}
            >
              {FILTER_LABELS[value]}
            </button>
          ))}
        </div>
      </header>
      {events.length === 0 ? (
        <p className="mfw-muted">Nothing recorded for this filter yet.</p>
      ) : (
        <ol className="mfw-events">
          {events.map((event) => (
            <li className={event.ok ? "mfw-event" : "mfw-event mfw-event-bad"} key={event.id}>
              <span className={`mfw-actor mfw-actor-${event.actor}`}>{actorIcon(event.actor)}</span>
              <span className="mfw-event-body">
                <span className="mfw-event-tool">{event.tool ?? "event"}</span>
                {event.argsPreview ? <code className="mfw-event-args">{event.argsPreview}</code> : null}
                {event.result ? <span className="mfw-event-result">{event.result}</span> : null}
              </span>
              <span className="mfw-event-when" title={formatClock(event.at)}>
                {formatRelative(event.at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
