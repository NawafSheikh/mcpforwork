/**
 * Where the visitor is: one place in the centre column, and on a phone one pane.
 *
 * Both are React state and never navigation, so the site tools registered on this page
 * survive every move. The phone pane follows the place: sending somebody to Requests
 * from the live feed has to actually show them the requests on a 390 px screen.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { PhonePane } from "./lib/constants";
import { OVERVIEW, type Place } from "./lib/places";

export interface NavValue {
  readonly place: Place;
  readonly pane: PhonePane;
  goTo(place: Place): void;
  setPane(pane: PhonePane): void;
}

const NavContext = createContext<NavValue | null>(null);

function paneFor(place: Place): PhonePane {
  return place.kind === "requests" ? "requests" : "board";
}

export function NavProvider({
  initial = OVERVIEW,
  children,
}: {
  readonly initial?: Place;
  readonly children: ReactNode;
}): JSX.Element {
  const [place, setPlace] = useState<Place>(initial);
  const [pane, setPane] = useState<PhonePane>("board");

  const goTo = useCallback((next: Place) => {
    setPlace(next);
    setPane(paneFor(next));
  }, []);

  const value = useMemo<NavValue>(() => ({ place, pane, goTo, setPane }), [place, pane, goTo]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

/** Outside a provider the app is a single pane, which is what a snapshot renders. */
export function useNav(): NavValue {
  const value = useContext(NavContext);
  if (value === null) throw new Error("useNav must be used inside NavProvider");
  return value;
}
