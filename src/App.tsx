/**
 * One page, three columns, no navigation.
 *
 * The room is in the top bar, the people and the places are on the left, the object is in
 * the middle and what is happening is on the right. Everything the visitor clicks is React
 * state, so the site tools this page registers are never unloaded by moving around.
 */
import { SharedBoard } from "./share/SharedBoard";
import { Center } from "./shell/center/Center";
import { LeftRail } from "./shell/rail/LeftRail";
import { RightPanel } from "./shell/live/RightPanel";
import { NavProvider, useNav } from "./shell/nav";
import { PhoneTabs } from "./shell/PhoneTabs";
import { TopBar } from "./shell/TopBar";
import { PackToastBridge, ToastProvider, ToolToastBridge } from "./shell/Toasts";

/**
 * A shared snapshot: the board only, read only, with no rails, no approve path, no audit
 * trail and no registered tools. It is somebody else's board, quoted.
 */
function SnapshotApp(): JSX.Element {
  return (
    <ToastProvider>
      <div className="mfw-app mfw-app--snapshot">
        <TopBar snapshot />
        <main className="mfw-center">
          <SharedBoard />
        </main>
      </div>
    </ToastProvider>
  );
}

function Frame({ editable }: { readonly editable: boolean }): JSX.Element {
  const { pane } = useNav();
  return (
    <div className="mfw-app" data-pane={pane}>
      <TopBar editable={editable} />
      <div className="mfw-frame">
        <LeftRail />
        <Center />
        <RightPanel />
      </div>
      <PhoneTabs />
    </div>
  );
}

export interface AppProps {
  readonly snapshot?: boolean;
  /** False for a read-only room link: the room name stops being editable. */
  readonly editable?: boolean;
}

export function App({ snapshot = false, editable = true }: AppProps): JSX.Element {
  if (snapshot) return <SnapshotApp />;
  return (
    <ToastProvider>
      <ToolToastBridge />
      <PackToastBridge />
      <NavProvider>
        <Frame editable={editable} />
      </NavProvider>
    </ToastProvider>
  );
}
