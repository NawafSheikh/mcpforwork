/**
 * Who is here, always on the page and never behind a popover: every person with what
 * they are looking at and what they hold, every agent with its caller name, the person
 * it belongs to when that is knowable, what it is working on and when it last called.
 */
import { useDisplayName } from "../../feedback";
import { usePresence } from "../../rooms";
import { CapabilityCards } from "../adapters/packs";
import { useWebmcpStatus, useWorkspace } from "../context";
import { formatRelative } from "../lib/format";
import { buildMembers, type AgentRow, type PersonRow } from "../lib/members";
import { placeLabel } from "../lib/places";
import { useNav } from "../nav";

const ALONE =
  "Only this browser. Press Invite and the link you send opens the same board for somebody else, with their agent.";

function Person({ person }: { readonly person: PersonRow }): JSX.Element {
  return (
    <li className="mfw-member">
      <span className="mfw-member__dot mfw-member__dot--person" aria-hidden="true" />
      <span className="mfw-member__body">
        <span className="mfw-member__name">
          {person.name}
          {person.self ? <span className="mfw-member__tag">you</span> : null}
          {person.hasAgent ? <span className="mfw-member__tag">agent here</span> : null}
        </span>
        <span className="mfw-member__meta">{`viewing ${person.viewing}`}</span>
        {person.holding.length > 0 ? (
          <span className="mfw-member__meta">{`holding ${person.holding.join(", ")}`}</span>
        ) : null}
      </span>
    </li>
  );
}

function Agent({ agent }: { readonly agent: AgentRow }): JSX.Element {
  return (
    <li className="mfw-member">
      <span className="mfw-member__dot mfw-member__dot--agent" aria-hidden="true" />
      <span className="mfw-member__body">
        <span className="mfw-member__name">
          {agent.caller}
          {agent.person === undefined ? null : (
            <span className="mfw-member__tag">{`with ${agent.person}`}</span>
          )}
        </span>
        <span className="mfw-member__meta">
          {agent.workingOn === undefined ? "no turn open" : `working on ${agent.workingOn}`}
        </span>
        <span className="mfw-member__meta">
          {agent.lastCallAt === undefined ? "no calls yet" : `last call ${formatRelative(agent.lastCallAt)}`}
        </span>
      </span>
    </li>
  );
}

export function Members(): JSX.Element {
  const workspace = useWorkspace();
  const presence = usePresence();
  const status = useWebmcpStatus();
  const myName = useDisplayName();
  const { place } = useNav();

  const members = buildMembers({
    presence,
    workspace,
    myName,
    viewing: placeLabel(place),
    agentHere: status.available && status.registered > 0,
  });

  return (
    <section className="mfw-rail__block" aria-label="Members">
      <h2 className="mfw-rail__title">Members</h2>
      <ul className="mfw-members">
        {members.people.map((person) => (
          <Person key={person.id} person={person} />
        ))}
        {members.agents.map((agent) => (
          <Agent key={agent.caller} agent={agent} />
        ))}
      </ul>
      {presence.slug === null && members.agents.length === 0 ? (
        <p className="mfw-rail__note">{ALONE}</p>
      ) : null}
      <CapabilityCards />
    </section>
  );
}
