/**
 * The guided replay engine.
 *
 * It drives the real store with the real audit writer, so the activity rail, the toasts
 * and every dashboard animate exactly as they do when ChatGPT is on the other end. The
 * only difference is that the data is the synthetic sample and the caller is "Replay".
 *
 * It never overwrites a board that already has content unless the caller says so: the
 * confirmation is a UI state, never a window.confirm.
 */
import { appendAudit, makeAuditEvent } from "../store";
import type { Workspace, WorkspaceStore } from "../types";
import { buildReplaySteps, clearedWorkspace, type ReplayStep } from "./replaySteps";

export const REPLAY_CALLER = "Replay";

export type ReplayPhase = "running" | "paused" | "done" | "stopped";

export interface ReplayState {
  readonly phase: ReplayPhase;
  /** Steps applied so far, 1 based once the first one lands. */
  readonly index: number;
  readonly total: number;
  readonly caption: string;
  readonly speed: number;
}

export interface ReplayOptions {
  /** Called after every state change: a new step, a pause, a speed change, the end. */
  readonly onState?: (state: ReplayState) => void;
  /** Called instead of running when the board already holds content and force is not set. */
  readonly onBlocked?: (workspace: Workspace) => void;
  /** Run even though the board has content. The UI sets this after the human confirms. */
  readonly force?: boolean;
  readonly speed?: number;
  /** Fixed clock, so tests get the same script every time. */
  readonly now?: Date;
}

/** The stop function, with the live controls hung off it. */
export type ReplayStop = (() => void) & {
  pause(): void;
  resume(): void;
  setSpeed(multiplier: number): void;
  state(): ReplayState;
};

/** True when a replay would destroy something the human or their agent put there. */
export function replayNeedsConfirm(ws: Workspace): boolean {
  return (
    Object.keys(ws.categories).length > 0 ||
    Object.keys(ws.monitors).length > 0 ||
    ws.overview !== undefined
  );
}

/** Clear the board back to empty, audited as a human action. Used by "stop and clear". */
export async function clearBoard(store: WorkspaceStore): Promise<void> {
  await store.update((ws) =>
    appendAudit(
      clearedWorkspace(ws),
      makeAuditEvent({
        actor: "human",
        tool: "clear_workspace",
        args: { confirm: "yes" },
        result: "Workspace cleared. The board is empty again.",
        ok: true,
      }),
    ),
  );
}

function applyStep(store: WorkspaceStore, step: ReplayStep): void {
  void store.update((ws) =>
    appendAudit(
      step.apply(ws),
      makeAuditEvent({
        actor: "agent",
        caller: REPLAY_CALLER,
        tool: step.tool,
        args: step.args,
        result: step.result,
        ok: step.ok,
      }),
    ),
  );
}

function idleStop(total: number): ReplayStop {
  const state: ReplayState = { phase: "stopped", index: 0, total, caption: "", speed: 1 };
  const stop = (): void => undefined;
  return Object.assign(stop, {
    pause: () => undefined,
    resume: () => undefined,
    setSpeed: () => undefined,
    state: () => state,
  });
}

interface Runtime {
  phase: ReplayPhase;
  index: number;
  caption: string;
  speed: number;
  /** Milliseconds still owed on the current caption, at speed 1. */
  owed: number;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Start the replay. Returns the stop function, which also carries pause, resume and
 * setSpeed. Stopping never touches the board: use clearBoard for that.
 */
export function startReplay(store: WorkspaceStore, opts: ReplayOptions = {}): ReplayStop {
  const steps = buildReplaySteps(opts.now ?? new Date());
  if (!opts.force && replayNeedsConfirm(store.get())) {
    opts.onBlocked?.(store.get());
    return idleStop(steps.length);
  }

  const run: Runtime = {
    phase: "running",
    index: 0,
    caption: "",
    speed: opts.speed && opts.speed > 0 ? opts.speed : 1,
    owed: 0,
    startedAt: 0,
    timer: null,
  };

  const snapshot = (): ReplayState => ({
    phase: run.phase,
    index: run.index,
    total: steps.length,
    caption: run.caption,
    speed: run.speed,
  });
  const emit = (): void => opts.onState?.(snapshot());

  const cancel = (): void => {
    if (run.timer !== null) clearTimeout(run.timer);
    run.timer = null;
  };

  const arm = (): void => {
    cancel();
    run.startedAt = Date.now();
    run.timer = setTimeout(advance, Math.max(0, run.owed / run.speed));
  };

  const elapsedAtSpeed1 = (): number => (Date.now() - run.startedAt) * run.speed;

  function advance(): void {
    if (run.phase !== "running") return;
    const step = steps[run.index];
    if (!step) {
      cancel();
      run.phase = "done";
      run.caption = "";
      emit();
      return;
    }
    run.index += 1;
    run.caption = step.caption;
    run.owed = step.holdMs;
    applyStep(store, step);
    emit();
    arm();
  }

  const stop = (): void => {
    if (run.phase === "stopped") return;
    cancel();
    run.phase = "stopped";
    emit();
  };

  advance();

  return Object.assign(stop, {
    pause(): void {
      if (run.phase !== "running") return;
      run.owed = Math.max(0, run.owed - elapsedAtSpeed1());
      cancel();
      run.phase = "paused";
      emit();
    },
    resume(): void {
      if (run.phase !== "paused") return;
      run.phase = "running";
      arm();
      emit();
    },
    setSpeed(multiplier: number): void {
      if (multiplier <= 0 || multiplier === run.speed) return;
      if (run.phase === "running") {
        run.owed = Math.max(0, run.owed - elapsedAtSpeed1());
        run.speed = multiplier;
        arm();
      } else {
        run.speed = multiplier;
      }
      emit();
    },
    state: snapshot,
  });
}
