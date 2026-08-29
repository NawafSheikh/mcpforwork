/**
 * The phone tab bar: one column at a time on a 390 px screen, with everything still on
 * the page. CSS hides it above 720 px, where all three columns fit side by side.
 */
import { PHONE_LABELS, PHONE_PANES } from "./lib/constants";
import { REQUESTS } from "./lib/places";
import { useNav } from "./nav";

export function PhoneTabs(): JSX.Element {
  const { pane, setPane, goTo } = useNav();
  return (
    <nav className="mfw-phonetabs" aria-label="Sections">
      {PHONE_PANES.map((entry) => (
        <button
          key={entry}
          type="button"
          className={entry === pane ? "mfw-phonetab mfw-phonetab--on" : "mfw-phonetab"}
          aria-current={entry === pane ? "true" : undefined}
          onClick={() => (entry === "requests" ? goTo(REQUESTS) : setPane(entry))}
        >
          {PHONE_LABELS[entry]}
        </button>
      ))}
    </nav>
  );
}
