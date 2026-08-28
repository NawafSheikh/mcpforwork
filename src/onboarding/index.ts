/**
 * Public surface of the onboarding module (owner A12).
 * The shell mounts Hero on the empty board and SampleRibbon plus ReplayHost on the board tab.
 */

export { Hero, HERO_TITLE, HERO_TITLE_LIVE, REPLAY_LABEL, SITE_URL } from "./Hero";
export { SampleRibbon, isSampleWorkspace, SAMPLE_RIBBON_TEXT } from "./SampleRibbon";
export { ReplayHost, useReplayState } from "./ReplayHost";
export { clearBoard, replayNeedsConfirm, startReplay, REPLAY_CALLER } from "./replay";
export type { ReplayOptions, ReplayPhase, ReplayState, ReplayStop } from "./replay";
export {
  buildReplaySteps,
  clearedWorkspace,
  replayDurationMs,
  REPLAY_PACING,
} from "./replaySteps";
export type { ReplayStep } from "./replaySteps";
export { createReplayController, replayController, IDLE_REPLAY } from "./replayController";
export type { ReplayController, ReplayUiPhase, ReplayUiState } from "./replayController";
