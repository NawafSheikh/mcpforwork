/**
 * The ribbon that stops the example board from being mistaken for a finished product.
 * It shows whenever the board is the synthetic sample, whether that came from the seed
 * button, the seed tool or the replay. Dismissing it lasts until the page is reloaded.
 */
import { useCallback, useState } from "react";
import { DEMO_MONITOR_INVOICES, DEMO_PROVENANCE } from "../demo/sampleWorkspace";
import { useShell, useWorkspace } from "../shell/context";
import { useToast } from "../shell/Toasts";
import type { Workspace } from "../types";
import { currentRoomSlug, leaveRoomUrl } from "../rooms/slug";
import { clearBoard } from "./replay";
import { replayController } from "./replayController";
import "./onboarding.css";

export const SAMPLE_RIBBON_TEXT =
  "Example board with synthetic data. Your ChatGPT builds yours live: see how";

/**
 * The seed keeps the workspace id and name, so the marker is in the data it writes:
 * the demo monitor, or the provenance line every sample category carries.
 */
export function isSampleWorkspace(ws: Workspace): boolean {
  if (ws.monitors[DEMO_MONITOR_INVOICES] !== undefined) return true;
  return Object.values(ws.categories).some((item) => item.provenance === DEMO_PROVENANCE);
}

export function SampleRibbon(): JSX.Element | null {
  const workspace = useWorkspace();
  const { store } = useShell();
  const push = useToast();
  const [dismissed, setDismissed] = useState(false);

  const inRoom = currentRoomSlug() !== null;

  // In a room a clear would propagate to everyone; leaving the room keeps their board intact.
  const onFresh = useCallback(async () => {
    if (inRoom) {
      window.location.assign(leaveRoomUrl());
      return;
    }
    await clearBoard(store);
    push("Board cleared. It is yours to fill now.", "ok");
  }, [inRoom, store, push]);

  if (dismissed || !isSampleWorkspace(workspace)) return null;

  return (
    <div className="mfw-sample-ribbon" role="note">
      <span className="mfw-sample-text">{SAMPLE_RIBBON_TEXT}</span>
      <span className="mfw-sample-actions">
        <button
          type="button"
          className="mfw-btn mfw-btn-primary"
          onClick={() => replayController.request(store)}
        >
          Watch it build
        </button>
        <button type="button" className="mfw-btn" onClick={() => void onFresh()}>
          {inRoom ? "Leave room and start fresh" : "Start fresh"}
        </button>
        <button
          type="button"
          className="mfw-btn mfw-btn-ghost mfw-sample-dismiss"
          aria-label="Dismiss this ribbon"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </span>
    </div>
  );
}
