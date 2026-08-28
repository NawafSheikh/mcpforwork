/**
 * Everything the replay puts on screen: the confirmation card, the floating caption bar
 * with its controls, and the end card that says out loud that it was a simulation.
 * Mounted once next to the board; it renders nothing at all while the replay is idle.
 */
import { useCallback, useSyncExternalStore } from "react";
import { useShell } from "../shell/context";
import { useToast } from "../shell/Toasts";
import { copyText } from "../shell/lib/clipboard";
import { getPrompt, STARTER_ID } from "../prompts";
import { clearBoard } from "./replay";
import { IDLE_REPLAY, replayController, type ReplayUiState } from "./replayController";
import "./onboarding.css";

export function useReplayState(): ReplayUiState {
  return useSyncExternalStore(
    replayController.subscribe,
    replayController.get,
    () => IDLE_REPLAY,
  );
}

function ConfirmCard(): JSX.Element {
  const { store } = useShell();
  return (
    <div className="mfw-replay-card" role="alertdialog" aria-label="Replay confirmation">
      <h2 className="mfw-replay-card-title">Replace what is on this board?</h2>
      <p className="mfw-replay-card-body">
        The replay starts from an empty board, so the categories and monitors already here
        would go. Nothing is stored on a server, so there is nothing to undo.
      </p>
      <div className="mfw-replay-actions">
        <button
          type="button"
          className="mfw-btn mfw-btn-primary"
          onClick={() => replayController.confirm(store)}
        >
          Clear it and replay
        </button>
        <button type="button" className="mfw-btn" onClick={() => replayController.cancel()}>
          Keep my board
        </button>
      </div>
    </div>
  );
}

function CaptionBar({ state }: { readonly state: ReplayUiState }): JSX.Element {
  const { store } = useShell();
  const paused = state.phase === "paused";
  return (
    <div className="mfw-replay-bar" role="status" aria-live="polite">
      <span className="mfw-replay-count">
        Step {state.index} of {state.total}
      </span>
      <span className="mfw-replay-caption">{state.caption}</span>
      <span className="mfw-replay-controls">
        <button
          type="button"
          className="mfw-btn"
          onClick={() => (paused ? replayController.resume() : replayController.pause())}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          className="mfw-btn"
          aria-pressed={state.speed > 1}
          onClick={() => replayController.toggleSpeed()}
        >
          {state.speed > 1 ? "Speed x2" : "Speed x1"}
        </button>
        <button type="button" className="mfw-btn" onClick={() => replayController.stopAndClear(store)}>
          Stop and clear
        </button>
      </span>
    </div>
  );
}

function EndCard(): JSX.Element {
  const { store } = useShell();
  const push = useToast();

  const onCopy = useCallback(async () => {
    const ok = await copyText(getPrompt(STARTER_ID));
    push(ok ? "Starter prompt copied." : "Copy blocked by the browser.", ok ? "ok" : "warn");
  }, [push]);

  const onClear = useCallback(async () => {
    replayController.dismiss();
    await clearBoard(store);
  }, [store]);

  return (
    <div className="mfw-replay-card" role="dialog" aria-label="Replay finished">
      <h2 className="mfw-replay-card-title">This was a simulation</h2>
      <p className="mfw-replay-card-body">
        No mailbox was read and nothing left this browser. Your ChatGPT builds the real one the
        same way, by calling the same tools on this page while you watch.
      </p>
      <div className="mfw-replay-actions">
        <button type="button" className="mfw-btn mfw-btn-primary" onClick={() => void onCopy()}>
          Copy the starter prompt
        </button>
        <button type="button" className="mfw-btn" onClick={() => void onClear()}>
          Clear the board and start for real
        </button>
        <button type="button" className="mfw-btn mfw-btn-ghost" onClick={() => replayController.dismiss()}>
          Keep looking
        </button>
      </div>
    </div>
  );
}

export function ReplayHost(): JSX.Element | null {
  const state = useReplayState();
  if (state.phase === "idle") return null;
  if (state.phase === "confirm") return <ConfirmCard />;
  if (state.phase === "done") return <EndCard />;
  return <CaptionBar state={state} />;
}
