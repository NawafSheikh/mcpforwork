/**
 * Public surface of the dashboard DSL (owner A1).
 * The shell renders these components; the tool layer uses the pure helpers.
 */

export { DashboardView } from "./DashboardView";
export type { DashboardViewProps } from "./DashboardView";
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

export { deltaTone, formatClock, formatNumber, formatValue } from "./format";
export type { DeltaTone } from "./format";

export { BarChartView, DonutChartView, LineChartView, TableView } from "./charts";
export { CHART_COLORS, CHART_HEIGHT, colorAt } from "./charts";
