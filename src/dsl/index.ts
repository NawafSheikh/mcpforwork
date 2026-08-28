/**
 * Public surface of the dashboard DSL (owner A1, wave 2 edits by A7).
 * The shell renders these components; the tool layer uses the pure helpers.
 */

export { DashboardView } from "./DashboardView";
export type { ChartRenderer, DashboardViewProps } from "./DashboardView";
export { OverviewView } from "./OverviewView";
export type { OverviewViewProps } from "./OverviewView";
export { CategoryCard } from "./CategoryCard";
export type { CategoryCardProps } from "./CategoryCard";
export { ChartCard, isChartEmpty } from "./ChartCard";
export type { ChartCardProps } from "./ChartCard";
export { KpiCard, KpiGrid } from "./KpiCard";
export type { KpiCardProps, KpiGridProps } from "./KpiCard";
export { BulletList, SpecHeader } from "./SpecHeader";
export type { BulletListProps, SpecHeaderProps } from "./SpecHeader";
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";
export { InsightBlock } from "./InsightBlock";
export type { InsightBlockProps } from "./InsightBlock";
export { ExecutiveBanner } from "./ExecutiveBanner";
export type { ExecutiveBannerProps } from "./ExecutiveBanner";

export { ICON_TONES, categoryIcon, kpiIcon } from "./icons";
export type { CategoryIcon } from "./icons";
export { chartCaption, insightSeverity, shareOfTotal, topShare } from "./insights";
export type { Severity, TopShare } from "./insights";

export {
  MAX_HIGHLIGHTS,
  MAX_NOTES,
  MAX_TABLE_COLUMNS,
  OVERVIEW_KPI_LIMIT,
  chartKey,
  clampChart,
  clampCharts,
  clampDashboard,
  clampKpis,
  clampOverview,
  describeDashboard,
  describeOverview,
} from "./validate";

export {
  insertChart,
  moveChart,
  removeChart,
  renameDashboard,
  renameOverview,
  replaceChart,
  setDashboardCharts,
  setOverviewCharts,
} from "./edit";

export { deltaTone, formatClock, formatNumber, formatValue } from "./format";
export type { DeltaTone } from "./format";

export { BarChartView, DonutChartView, LineChartView, TableView } from "./charts";
export {
  CHART_COLORS,
  CHART_HEIGHT,
  DARK_CHART_COLORS,
  LIGHT_CHART_COLORS,
  THEME_EVENT,
  chartTheme,
  colorAt,
  readThemeMode,
  useChartTheme,
  useThemeMode,
} from "./charts";
export type { ChartTheme, ThemeMode } from "./charts";
export { pointsDomain, valueDomain } from "./charts";
export type { AxisDomain } from "./charts";
export {
  DEFAULT_VIEW,
  SWITCHABLE_KINDS,
  applyChartView,
  canSort,
  canSwitchKind,
  sortPoints,
  sortRows,
} from "./charts";
export type { ChartView, SortMode } from "./charts";
