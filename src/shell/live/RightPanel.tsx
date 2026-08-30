/**
 * The right column: what to do next, what is waiting for you, and what is happening.
 *
 * "What just ran" lives here rather than on the Loops page, which is where it started.
 * The end-to-end run caught the reason: a script ran on the machine, the output came back
 * and the page showed nothing, because the person was on a different place. A result you
 * have to go hunting for is not shown to you.
 */
import { CodeRuns } from "../../packs/ui/CodeRuns";
import { Decisions } from "../../decisions/ui/Decisions";
import { LiveFeed } from "./LiveFeed";
import { NextStep } from "./NextStep";
import { OpenForYou } from "./OpenForYou";

export function RightPanel(): JSX.Element {
  return (
    <aside className="mfw-rail mfw-rail--right" aria-label="Live">
      <NextStep />
      <OpenForYou />
      <CodeRuns />
      <Decisions />
      <LiveFeed />
    </aside>
  );
}
