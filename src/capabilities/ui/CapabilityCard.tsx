/**
 * One capability card: a person, an agent or a robot, and what they can reach.
 *
 * The card is a description, not a permission. The one action on it is "ask", which
 * hands a composer somewhere else on the page a note target and a first line; nothing
 * is sent from here.
 */
import { askCapability } from "../../packs/events";
import type { Capability, FeedbackTargetKind } from "../../types";
import "./capabilities.css";

const KIND_LABEL: Readonly<Record<string, string>> = {
  person: "person",
  agent: "agent",
  robot: "robot",
};

/** A person is asked as a person; an agent and a robot are both asked as an agent. */
function targetKindFor(card: Capability): FeedbackTargetKind {
  return card.owner.kind === "person" ? "person" : "agent";
}

function firstSubject(card: Capability): string {
  return card.knows[0] ?? card.local[0] ?? card.packs[0] ?? "this board";
}

export function askText(card: Capability): string {
  return `${card.owner.name}, can you help with ${firstSubject(card)}?`;
}

function Row({ label, items }: { readonly label: string; readonly items: readonly string[] }): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div className="mfw-cap-row">
      <span className="mfw-cap-label">{label}</span>
      <span className="mfw-chips">
        {items.map((item) => (
          <span className="mfw-chip" key={item}>
            {item}
          </span>
        ))}
      </span>
    </div>
  );
}

export function CapabilityCard({
  card,
  onAsk,
}: {
  readonly card: Capability;
  /** Optional: the shell can intercept instead of using the event bus. */
  readonly onAsk?: (target: { kind: FeedbackTargetKind; id: string }, text: string) => void;
}): JSX.Element {
  const target = { kind: targetKindFor(card), id: card.owner.name };
  const text = askText(card);
  const ask = (): void => {
    if (onAsk !== undefined) onAsk(target, text);
    else askCapability.emit({ target, text });
  };
  const verb = card.owner.kind === "person" ? "Ask this person" : "Ask this agent";
  return (
    <article className={`mfw-cap mfw-cap-${card.owner.kind}`}>
      <header className="mfw-cap-head">
        <span className="mfw-cap-name">{card.owner.name}</span>
        <span className="mfw-chip">{KIND_LABEL[card.owner.kind] ?? card.owner.kind}</span>
      </header>
      <Row label="Site packs" items={card.packs} />
      <Row label="Locally" items={card.local} />
      <Row label="Knows" items={card.knows} />
      <button className="mfw-btn mfw-btn-ghost mfw-cap-ask" onClick={ask} type="button">
        {verb}
      </button>
    </article>
  );
}
