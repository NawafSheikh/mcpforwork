/**
 * Renders a DashboardSpec: title, up to four KPI cards, then the charts.
 * The spec is clamped first, so an over-eager agent can never blow up the page.
 * The shell may take over the title, the header controls and each chart card,
 * which is how human editing is layered on top without forking the renderer.
 */

import { useMemo, type ReactNode } from "react";
import type { Chart, DashboardSpec } from "../types";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";
import { KpiGrid } from "./KpiCard";
import { InsightBlock } from "./InsightBlock";
import { SpecHeader } from "./SpecHeader";
import { chartKey, clampDashboard, describeDashboard } from "./validate";
import "./styles.css";

export type ChartRenderer = (chart: Chart, chartId: string, index: number) => ReactNode;

export interface DashboardViewProps {
  readonly spec: DashboardSpec;
  /** Called with the chart id (or "chart-<index>") when a human wants to edit one. */
  readonly onEdit?: (chartId: string) => void;
  /** Pulses the card border once for 1.5s after the agent updated this spec. */
  readonly highlight?: boolean;
  /** Replaces the heading, for example with a click-to-edit title. */
  readonly titleNode?: ReactNode;
  /** Controls on the right of the header. */
  readonly headerActions?: ReactNode;
  /** Replaces the default chart card, for example with one carrying controls. */
  readonly renderChart?: ChartRenderer;
  /** Rendered after the notes: feedback box, prompts, anything the shell owns. */
  readonly footer?: ReactNode;
  /** Header only, for a collapsed card. */
  readonly collapsed?: boolean;
}

export function DashboardView({
  spec,
  onEdit,
  highlight = false,
  titleNode,
  headerActions,
  renderChart,
  footer,
  collapsed = false,
}: DashboardViewProps) {
  const safe = useMemo(() => clampDashboard(spec), [spec]);
  const title = safe.title && safe.title.trim() ? safe.title : safe.category;
  const notes = safe.notes ?? [];

  return (
    <section className="mfw-dsl mfw-surface" aria-label={`Dashboard for ${safe.category}`}>
      {highlight ? <span key={safe.updatedAt} className="mfw-pulse" aria-hidden="true" /> : null}
      <SpecHeader
        title={title}
        meta={describeDashboard(safe)}
        source={safe.source}
        titleNode={titleNode}
        actions={headerActions}
      />

      {collapsed ? null : (
        <>
          {safe.kpis.length > 0 ? (
            <KpiGrid kpis={safe.kpis} />
          ) : (
            <EmptyState
              title="No KPIs yet"
              hint="Ask your agent to call upsert_dashboard with up to four headline numbers."
            />
          )}

          {safe.charts.length > 0 ? (
            <div className="mfw-dsl-grid">
              {safe.charts.map((chart, index) => {
                const id = chartKey(chart, index);
                return (
                  renderChart?.(chart, id, index) ?? (
                    <ChartCard key={id} chart={chart} chartId={id} onEdit={onEdit} />
                  )
                );
              })}
            </div>
          ) : (
            <EmptyState title="No charts yet" hint="Charts arrive as bar, line, donut or table specs." />
          )}

          <InsightBlock
            label="AI Intelligence"
            items={notes}
            caption="Written by the agent through upsert_dashboard, not by this page."
          />
          {footer}
        </>
      )}
    </section>
  );
}
