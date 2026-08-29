/**
 * Who is here, always on the page and never behind a popover.
 *
 * Outside a room there are exactly two of you: this browser, and the agent that may or
 * may not be attached to it. Nobody is invented, and a visitor who has not typed a name
 * is "You", never a placeholder word pretending to be a stranger.
 * In a room the real peers take over, each with what they are looking at and what they
 * hold, and every agent with its caller name and last call.
 */
import { usePresence } from "../../rooms";
import { CapabilityCards } from "../adapters/packs";
import { useWebmcpStatus, useWorkspace } from "../context";
import { AGENT_HEADING, AGENT_ROW_OFF, AGENT_ROW_ON } from "../lib/constants";
import { formatRelative } from "../lib/format";
import { buildMembers, type AgentRow, type PersonRow } from "../lib/members";
import { useMyName } from "../lib/name";
import { placeLabel } from "../lib/places";
import { useNav } from "../nav";

const ALONE =
  "Only this browser. Press Invite and the link you send opens the same board for somebody else, with their agent.";

function Row({
  kind,
  name,
  tags = [],
  metas,
}: {
  readonly kind: "person" | "agent";
  readonly name: string;
  readonly tags?: readonly string[];
  readonly metas: readonly string[];
}): JSX.Element {
  return (
    <li className="mfw-member">
      <span className={`mfw-member__dot mfw-member__dot--${kind}`} aria-hidden="true" />
      <span className="mfw-member__body">
        <span className="mfw-member__name">
          {name}
          {tags.map((tag) => (
            <span className="mfw-member__tag" key={tag}>
              {tag}
            </span>
          ))}
        </span>
        {metas.map((meta) => (
          <span className="mfw-member__meta" key={meta}>
            {meta}
          </span>
        ))}
      </span>
    </li>
  );
}

function personTags(person: PersonRow): readonly string[] {
  return [...(person.self ? ["you"] : []), ...(person.hasAgent ? ["agent here"] : [])];
}

function personMetas(person: PersonRow): readonly string[] {
  const holding = person.holding.length > 0 ? [`holding ${person.holding.join(", ")}`] : [];
  return [`viewing ${person.viewing}`, ...holding];
}

function agentMetas(agent: AgentRow): readonly string[] {
  return [
    agent.workingOn === undefined ? "no turn open" : `working on ${agent.workingOn}`,
    agent.lastCallAt === undefined ? "no calls yet" : `last call ${formatRelative(agent.lastCallAt)}`,
  ];
}

export function Members(): JSX.Element {
  const workspace = useWorkspace();
  const presence = usePresence();
  const status = useWebmcpStatus();
  const me = useMyName();
  const { place } = useNav();
  const agentHere = status.available && status.registered > 0;
  const alone = presence.slug === null;

  const members = buildMembers({
    presence,
    workspace,
    myName: me.label,
    viewing: placeLabel(place),
    agentHere,
  });

  return (
    <section className="mfw-rail__block" aria-label="Members">
      <h2 className="mfw-rail__title">Members</h2>
      <ul className="mfw-members">
        {members.people.map((person) => (
          <Row
            key={person.id}
            kind="person"
            name={person.name}
            tags={personTags(person)}
            metas={personMetas(person)}
          />
        ))}
        {alone ? (
          <Row
            kind="agent"
            name={AGENT_HEADING}
            metas={[agentHere ? AGENT_ROW_ON : AGENT_ROW_OFF]}
          />
        ) : (
          members.agents.map((agent) => (
            <Row
              key={agent.caller}
              kind="agent"
              name={agent.caller}
              tags={agent.person === undefined ? [] : [`with ${agent.person}`]}
              metas={agentMetas(agent)}
            />
          ))
        )}
      </ul>
      {alone ? <p className="mfw-rail__note">{ALONE}</p> : null}
      <CapabilityCards />
    </section>
  );
}
