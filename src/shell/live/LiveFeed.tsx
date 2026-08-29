/**
 * The live feed: every call and every human action as it lands, grouped by the peer that
 * made it, newest first, filterable by person or agent. Clicking a line jumps to the
 * object it changed, which is the whole reason it is next to the board and not in a tab.
 */
import { useMemo, useState } from "react";
import type { AuditEvent } from "../../types";
import { useWorkspace } from "../context";
import { EVERYONE, feedPeers, groupFeed } from "../lib/feed";
import { RAIL_EVENT_COUNT } from "../lib/constants";
import { actorIcon, describeToolEvent, formatClock, formatRelative } from "../lib/format";
import { placeForEvent } from "../lib/places";
import { useNav } from "../nav";

function EventLine({ event, onJump }: {
  readonly event: AuditEvent;
  readonly onJump: (() => void) | null;
}): JSX.Element {
  const text = describeToolEvent(event);
  const when = (
    <span className="mfw-feed__when" title={formatClock(event.at)}>
      {formatRelative(event.at)}
    </span>
  );
  return (
    <li className={event.ok ? "mfw-feed__line" : "mfw-feed__line mfw-feed__line--bad"}>
      {onJump === null ? (
        <span className="mfw-feed__text">{text}</span>
      ) : (
        <button type="button" className="mfw-feed__jump" onClick={onJump}>
          {text}
        </button>
      )}
      {when}
    </li>
  );
}

function PeerFilter({ names, value, onSelect }: {
  readonly names: readonly string[];
  readonly value: string;
  readonly onSelect: (next: string) => void;
}): JSX.Element | null {
  if (names.length < 2) return null;
  return (
    <label className="mfw-feed__filter">
      <span className="mfw-visually-hidden">Filter the feed by person or agent</span>
      <select value={value} onChange={(event) => onSelect(event.target.value)}>
        <option value={EVERYONE}>Everyone</option>
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LiveFeed(): JSX.Element {
  const workspace = useWorkspace();
  const { goTo } = useNav();
  const [peer, setPeer] = useState<string>(EVERYONE);

  const names = useMemo(() => feedPeers(workspace), [workspace]);
  const groups = useMemo(
    () => groupFeed(workspace.audit, peer, RAIL_EVENT_COUNT),
    [workspace.audit, peer],
  );

  return (
    <section className="mfw-rail__block" aria-label="Live feed">
      <header className="mfw-feed__head">
        <h2 className="mfw-rail__title">Live</h2>
        <PeerFilter names={names} value={peer} onSelect={setPeer} />
      </header>
      {groups.length === 0 ? (
        <p className="mfw-rail__note">
          Nothing yet. Every call from an agent, and everything a person does here, lands in this
          list as it happens.
        </p>
      ) : (
        <ol className="mfw-feed">
          {groups.map((group) => (
            <li className="mfw-feed__group" key={group.id}>
              <span className="mfw-feed__peer">
                <span className={`mfw-actor mfw-actor-${group.actor}`}>{actorIcon(group.actor)}</span>
                {group.peer}
              </span>
              <ol className="mfw-feed__lines">
                {group.events.map((event) => {
                  const place = placeForEvent(event, workspace);
                  return (
                    <EventLine
                      key={event.id}
                      event={event}
                      onJump={place === null ? null : () => goTo(place)}
                    />
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
