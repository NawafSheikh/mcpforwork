/** Single page app. Tabs are React state, so the registered site tools never unload. */
import { useState } from "react";
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

export function App(): JSX.Element {
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
