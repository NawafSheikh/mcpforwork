/** The left column: who is here, then where the work is. */
import { Members } from "./Members";
import { Places } from "./Places";

export function LeftRail(): JSX.Element {
  return (
    <aside className="mfw-rail mfw-rail--left" aria-label="People and places">
      <Members />
      <Places />
    </aside>
  );
}
