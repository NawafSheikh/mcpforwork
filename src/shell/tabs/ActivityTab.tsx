/** Activity: the audit rail, newest first, filterable by actor and by caller. */
import { useMemo, useState } from "react";
import type { Actor, AuditEvent } from "../../types";
import { callerName } from "../AgentRail";
import { useWorkspace } from "../context";
import { actorIcon, formatClock, formatRelative } from "../lib/format";

type Filter = Actor | "all";

const ALL_CALLERS = "all";

const FILTERS: readonly Filter[] = ["all", "agent", "human", "system"];

const FILTER_LABELS: Readonly<Record<Filter, string>> = {
  all: "Everything",
  agent: "ChatGPT",
  human: "You",
  system: "System",
};

/** Every name that has appeared in the trail, so parallel workers are pickable. */
function callerNames(events: readonly AuditEvent[]): readonly string[] {
  return [...new Set(events.map(callerName))].sort((a, b) => a.localeCompare(b));
}

function ActorFilter({
  value,
  onSelect,
}: {
  readonly value: Filter;
  readonly onSelect: (next: Filter) => void;
}): JSX.Element {
  return (
    <div className="mfw-filters" role="group" aria-label="Filter by actor">
      {FILTERS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          className={value === option ? "mfw-filter mfw-filter-on" : "mfw-filter"}
          onClick={() => onSelect(option)}
        >
          {FILTER_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

function CallerFilter({
  value,
  names,
  onSelect,
}: {
  readonly value: string;
  readonly names: readonly string[];
  readonly onSelect: (next: string) => void;
}): JSX.Element | null {
  if (names.length < 2) return null;
  const options = [ALL_CALLERS, ...names];
  return (
    <div className="mfw-filters" role="group" aria-label="Filter by caller">
      {options.map((name) => (
        <button
          key={name}
          type="button"
          aria-pressed={value === name}
          className={value === name ? "mfw-filter mfw-filter-on" : "mfw-filter"}
          onClick={() => onSelect(name)}
        >
          {name === ALL_CALLERS ? "Every caller" : name}
        </button>
      ))}
    </div>
  );
}

function EventRow({ event }: { readonly event: AuditEvent }): JSX.Element {
  return (
    <li className={event.ok ? "mfw-event" : "mfw-event mfw-event-bad"}>
      <span className={`mfw-actor mfw-actor-${event.actor}`}>{actorIcon(event.actor)}</span>
      <span className="mfw-event-body">
        <span className="mfw-event-tool">
          {`${event.tool ?? "event"} `}
          <span className="mfw-chip mfw-caller">{callerName(event)}</span>
        </span>
        {event.argsPreview ? <code className="mfw-event-args">{event.argsPreview}</code> : null}
        {event.result ? <span className="mfw-event-result">{event.result}</span> : null}
      </span>
      <span className="mfw-event-when" title={formatClock(event.at)}>
        {formatRelative(event.at)}
      </span>
    </li>
  );
}

export function ActivityTab(): JSX.Element {
  const workspace = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [caller, setCaller] = useState<string>(ALL_CALLERS);

  const names = useMemo(() => callerNames(workspace.audit), [workspace.audit]);

  const events = useMemo(() => {
    const newestFirst = [...workspace.audit].reverse();
    return newestFirst
      .filter((event) => filter === "all" || event.actor === filter)
      .filter((event) => caller === ALL_CALLERS || callerName(event) === caller);
  }, [workspace.audit, filter, caller]);

  return (
    <section className="mfw-card mfw-activity">
      <header className="mfw-activity-head">
        <h3>Activity</h3>
        <ActorFilter value={filter} onSelect={setFilter} />
        <CallerFilter value={caller} names={names} onSelect={setCaller} />
      </header>
      {events.length === 0 ? (
        <p className="mfw-muted">Nothing recorded for this filter yet.</p>
      ) : (
        <ol className="mfw-events">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </ol>
      )}
    </section>
  );
}
