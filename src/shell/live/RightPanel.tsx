/** The right column: what to do next, what is waiting for you, and what is happening. */
import { LiveFeed } from "./LiveFeed";
import { NextStep } from "./NextStep";
import { OpenForYou } from "./OpenForYou";

export function RightPanel(): JSX.Element {
  return (
    <aside className="mfw-rail mfw-rail--right" aria-label="Live">
      <NextStep />
      <OpenForYou />
      <LiveFeed />
    </aside>
  );
}
