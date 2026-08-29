/**
 * The centre column: the object being worked on, and nothing else.
 *
 * Which object is React state (src/shell/nav.tsx), never navigation, so the site tools
 * registered on this page survive every move. The landing room card only stands in for
 * the overview: every other place stays reachable from the rail on a cold board.
 */
import { useEffect } from "react";
import { ReplayHost, SampleRibbon } from "../../onboarding";
import { askCapability } from "../../packs";
import { usePresence } from "../../rooms";
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
  const presence = usePresence();
  const { place, goTo } = useNav();
  // A capability card asked for somebody: the composer that answers it lives on the
  // requests page, so that is where the click has to land.
  useEffect(() => askCapability.subscribe(() => goTo(REQUESTS)), [goTo]);
  const wrongKey = useWrongKey();
  const landing = presence.slug === null && boardIsEmpty(workspace);

  return (
    <main className="mfw-center" aria-label="Board">
      <SampleRibbon />
      {wrongKey ? <WrongKey /> : <Page place={place} landing={landing} />}
      <ReplayHost />
    </main>
  );
}
