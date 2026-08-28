/** Public surface of the board (owner A7). BoardTab renders Board and nothing else. */

export { Board } from "./Board";
export type { BoardProps } from "./Board";
export { CategoryNav, OVERVIEW_ID } from "./CategoryNav";
export { CategoryPane } from "./CategoryPane";
export { OverviewPane } from "./OverviewPane";
export { ChartPanel } from "./ChartPanel";
export { AskAgentButton } from "./AskAgentButton";
export { EditableTitle } from "./EditableTitle";
export { UndoToast, UNDO_MS } from "./UndoToast";
export { FeedbackSlot } from "./FeedbackSlot";
export { SummaryTable, summaryFacts, summaryMeta, summaryRows } from "./SummaryTable";
export { pinnedKey, readPinned, sortPinnedFirst, togglePinned, usePinned, writePinned } from "./pinned";
export type { PinnedState } from "./pinned";
export { useBoardEdits } from "./useBoardEdits";
export type { BoardEdits, RemovedChart } from "./useBoardEdits";
export {
  applyInsert,
  applyMove,
  applyRemove,
  applyRename,
  applyReplace,
  chartAt,
  chartsOf,
  mapDashboard,
  mapOverview,
  targetLabel,
} from "./mutate";
export type { EditTarget } from "./mutate";
export {
  SITE,
  buildDashboardPrompt,
  chartPrompt,
  dashboardPrompt,
  firstDashboardPrompt,
  overviewChartPrompt,
  overviewPrompt,
} from "./prompts";
