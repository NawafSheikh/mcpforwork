/**
 * One replay at a time, held outside React so the trigger (the hero, the ribbon) and the
 * caption bar can live in different parts of the tree without a provider. Same shape as
 * the WebMCP status store the header already subscribes to: get, subscribe, done.
 */
import type { WorkspaceStore } from "../types";
import { clearBoard, startReplay, type ReplayState, type ReplayStop } from "./replay";

export type ReplayUiPhase = "idle" | "confirm" | "running" | "paused" | "done";

export interface ReplayUiState {
  readonly phase: ReplayUiPhase;
  readonly index: number;
  readonly total: number;
  readonly caption: string;
  readonly speed: number;
}

export const IDLE_REPLAY: ReplayUiState = {
  phase: "idle",
  index: 0,
  total: 0,
  caption: "",
  speed: 1,
};

export interface ReplayController {
  get(): ReplayUiState;
  subscribe(listener: () => void): () => void;
  /** Start, or ask first when the board already holds something. */
  request(store: WorkspaceStore): void;
  /** The human said yes in the confirm card. */
  confirm(store: WorkspaceStore): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  /** Flips between x1 and x2. */
  toggleSpeed(): void;
  /** Halts the replay and empties the board. */
  stopAndClear(store: WorkspaceStore): void;
  /** Closes the end card and leaves the board as it is. */
  dismiss(): void;
}

const FAST = 2;

function uiPhase(phase: ReplayState["phase"]): ReplayUiPhase {
  if (phase === "running") return "running";
  if (phase === "paused") return "paused";
  if (phase === "done") return "done";
  return "idle";
}

export function createReplayController(): ReplayController {
  let state: ReplayUiState = IDLE_REPLAY;
  let handle: ReplayStop | null = null;
  const listeners = new Set<() => void>();

  const set = (next: ReplayUiState): void => {
    state = next;
    for (const listener of [...listeners]) listener();
  };

  const onState = (live: ReplayState): void => {
    set({
      phase: uiPhase(live.phase),
      index: live.index,
      total: live.total,
      caption: live.caption,
      speed: live.speed,
    });
  };

  const begin = (store: WorkspaceStore, force: boolean): void => {
    handle?.();
    handle = startReplay(store, {
      force,
      onState,
      onBlocked: () => set({ ...IDLE_REPLAY, phase: "confirm" }),
    });
  };

  const halt = (): void => {
    handle?.();
    handle = null;
  };

  return {
    get: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    request(store: WorkspaceStore): void {
      if (state.phase === "running" || state.phase === "paused") return;
      begin(store, false);
    },
    confirm(store: WorkspaceStore): void {
      begin(store, true);
    },
    cancel(): void {
      halt();
      set(IDLE_REPLAY);
    },
    pause(): void {
      handle?.pause();
    },
    resume(): void {
      handle?.resume();
    },
    toggleSpeed(): void {
      handle?.setSpeed(state.speed === FAST ? 1 : FAST);
    },
    stopAndClear(store: WorkspaceStore): void {
      halt();
      set(IDLE_REPLAY);
      void clearBoard(store);
    },
    dismiss(): void {
      halt();
      set(IDLE_REPLAY);
    },
  };
}

/** The one the shell uses. Tests build their own with createReplayController. */
export const replayController: ReplayController = createReplayController();
