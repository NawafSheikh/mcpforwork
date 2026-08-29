/**
 * Every card on this board, for the left rail. Empty until somebody publishes one, and
 * it says so in the same plain words the tool does rather than showing nothing.
 */
import type { FeedbackTargetKind } from "../../types";
import { useCapabilities } from "../useCapabilities";
import { CapabilityCard } from "./CapabilityCard";
import "./capabilities.css";

const EMPTY = "No capability cards yet. Ask your agent to call publish_capabilities.";

export function CapabilityCards({
  onAsk,
}: {
  readonly onAsk?: (target: { kind: FeedbackTargetKind; id: string }, text: string) => void;
}): JSX.Element {
  const { cards } = useCapabilities();
  if (cards.length === 0) return <p className="mfw-rail__note">{EMPTY}</p>;
  return (
    <div className="mfw-cap-list">
      {cards.map((card) => (
        <CapabilityCard card={card} key={card.owner.name} {...(onAsk === undefined ? {} : { onAsk })} />
      ))}
    </div>
  );
}
