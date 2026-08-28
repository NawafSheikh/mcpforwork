/** Single page app. Tabs are React state, so the registered site tools never unload. */
import { useState } from "react";
import { SharedBoard } from "./share/SharedBoard";
import { AgentRail } from "./shell/AgentRail";
import { Header } from "./shell/Header";
import { TabBar } from "./shell/TabBar";
import { ToastProvider, ToolToastBridge } from "./shell/Toasts";
import { AboutTab } from "./shell/tabs/AboutTab";
import { ActivityTab } from "./shell/tabs/ActivityTab";
import { BoardTab } from "./shell/tabs/BoardTab";
import { MonitorsTab } from "./shell/tabs/MonitorsTab";
import type { TabId } from "./shell/lib/constants";

function TabPanel({ tab }: { readonly tab: TabId }): JSX.Element {
  if (tab === "monitors") return <MonitorsTab />;
  if (tab === "activity") return <ActivityTab />;
  if (tab === "about") return <AboutTab />;
  return <BoardTab />;
}

/**
 * A shared snapshot: the board only, read only, with no monitors tab, no approve path,
 * no audit trail and no registered tools. It is somebody else's board, quoted.
 */
function SnapshotApp(): JSX.Element {
  return (
    <ToastProvider>
      <div className="mfw-app">
        <Header snapshot />
        <div className="mfw-body">
          <main className="mfw-main">
            <SharedBoard />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

function WorkspaceApp(): JSX.Element {
  const [tab, setTab] = useState<TabId>("board");
  return (
    <ToastProvider>
      <ToolToastBridge />
      <div className="mfw-app">
        <Header />
        <TabBar active={tab} onSelect={setTab} />
        <div className="mfw-body">
          <main
            className="mfw-main"
            role="tabpanel"
            id={`mfw-panel-${tab}`}
            aria-labelledby={`mfw-tab-${tab}`}
          >
            <TabPanel tab={tab} />
          </main>
          <AgentRail />
        </div>
      </div>
    </ToastProvider>
  );
}

export function App({ snapshot = false }: { readonly snapshot?: boolean }): JSX.Element {
  return snapshot ? <SnapshotApp /> : <WorkspaceApp />;
}
