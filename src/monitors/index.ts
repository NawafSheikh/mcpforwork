/**
 * Monitors barrel: schedule parsing, the tool handlers, the shared run path,
 * and the demo simulator.
 */

export {
  CronError,
  describeCron,
  isScheduleError,
  nextRunAt,
  nextRunFromText,
  parseCron,
  parseSchedule,
} from "./schedule";
export type { ParsedSchedule, ScheduleError, ScheduleResult } from "./schedule";

export {
  approve_draft,
  decline_draft,
  get_run_log,
  humanDecide,
  list_monitors,
  monitorHandlers,
  register_monitor,
  report_monitor_run,
  scheduledTaskPrompt,
  set_policy,
} from "./handlers";
export type { HandlerFn, HandlerResult } from "./handlerTypes";

export { applyRun, autosInRun, countStatuses, nextMonitorId } from "./runCore";
export type { AppliedRun, RunCounts } from "./runCore";

export { simulateRun, startDemoScheduler } from "./simulator";
export type { DemoSchedulerOptions, Scenario } from "./simulator";
