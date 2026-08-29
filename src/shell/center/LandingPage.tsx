/**
 * The first run: a blank canvas that talks about the person, not the product.
 *
 * Three questions in order, and nothing else. Who are you, where is your agent, and what
 * on this page is yours to move. There is no sample board, no live room to peek at and
 * no marketing line: the board stays empty until an agent fills it.
 */
import { AgentCard } from "./landing/AgentCard";
import { ControlsCard } from "./landing/ControlsCard";
import { NameCard } from "./landing/NameCard";

export function LandingPage(): JSX.Element {
  return (
    <div className="mfw-page mfw-landing">
      <NameCard />
      <AgentCard />
      <ControlsCard />
    </div>
  );
}
