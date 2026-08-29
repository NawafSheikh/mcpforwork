/**
 * The centre column: the object being worked on, and nothing else.
 *
 * Which object is React state (src/shell/nav.tsx), never navigation, so the site tools
 * registered on this page survive every move. The first-run page only stands in for the
 * overview: every other place stays reachable from the rail on a cold board.
 */
import { useEffect } from "react";
import { askCapability } from "../../packs";
import { useWorkspace } from "../context";
import { boardIsEmpty } from "../lib/room";
import { REQUESTS, type Place } from "../lib/places";
import { useNav } from "../nav";
import { AboutTab } from "../tabs/AboutTab";
import { ActivityTab } from "../tabs/ActivityTab";
import { MonitorsTab } from "../tabs/MonitorsTab";
import { BoardHost } from "./BoardHost";
import { DatasetsPage } from "./DatasetsPage";
import { LandingPage } from "./LandingPage";
import { RequestsPage } from "./RequestsPage";
import { WrongKey } from "./WrongKey";
import { useWrongKey } from "./useWrongKey";

function Page({ place, landing }: { readonly place: Place; readonly landing: boolean }): JSX.Element {
  if (place.kind === "monitors") return <MonitorsTab />;
  if (place.kind === "datasets") return <DatasetsPage />;
  if (place.kind === "requests") return <RequestsPage />;
  if (place.kind === "activity") return <ActivityTab />;
  if (place.kind === "about") return <AboutTab />;
  if (landing && place.kind === "overview") return <LandingPage />;
  return <BoardHost />;
}

export function Center(): JSX.Element {
  const workspace = useWorkspace();
  const { place, goTo } = useNav();
  // A capability card asked for somebody: the composer that answers it lives on the
  // requests page, so that is where the click has to land.
  useEffect(() => askCapability.subscribe(() => goTo(REQUESTS)), [goTo]);
  const wrongKey = useWrongKey();
  // An empty board is an empty board, in a room or not: there is nothing to draw yet,
  // so the centre asks the three first-run questions instead of painting a blank grid.
  const landing = boardIsEmpty(workspace);

  return (
    <main className="mfw-center" aria-label="Board">
      {wrongKey ? <WrongKey /> : <Page place={place} landing={landing} />}
    </main>
  );
}
