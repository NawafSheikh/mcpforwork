/**
 * Renders an OverviewSpec: the cross-category board with up to six KPIs,
 * the same chart grid as a dashboard, and the agent's highlights.
 * With `banner` the header and KPIs become the gradient executive summary,
 * which is the one surface on the board that breaks the white-card rhythm.
 */

import { useMemo, type ReactNode } from "react";
import type { OverviewSpec } from "../types";
import { ChartCard } from "./ChartCard";
import type { ChartRenderer } from "./DashboardView";
import { EmptyState } from "./EmptyState";
import { ExecutiveBanner } from "./ExecutiveBanner";
import { KpiGrid } from "./KpiCard";
import { InsightBlock } from "./InsightBlock";
import { SpecHeader } from "./SpecHeader";
import { chartKey, clampOverview, describeOverview } from "./validate";
import "./styles.css";

export interface OverviewViewProps {
  readonly spec: OverviewSpec;
  /** Called with the chart id (or "chart-<index>") when a human wants to edit one. */
  readonly onEdit?: (chartId: string) => void;
  /** Pulses the card border once for 1.5s after the agent updated this spec. */
  readonly highlight?: boolean;
  readonly titleNode?: ReactNode;
  readonly headerActions?: ReactNode;
  readonly renderChart?: ChartRenderer;
  readonly footer?: ReactNode;
  readonly collapsed?: boolean;
  /** Executive summary treatment: gradient header carrying the KPIs. */
  readonly banner?: boolean;
}

export function OverviewView({
  spec,
  onEdit,
  highlight = false,
  titleNode,
  headerActions,
  renderChart,
  footer,
  collapsed = false,
  banner = false,
}: OverviewViewProps) {
  const safe = useMemo(() => clampOverview(spec), [spec]);
  const highlights = safe.highlights ?? [];
  const meta = describeOverview(safe);

  return (
    <section className="mfw-dsl mfw-surface" aria-label="Workspace overview">
      {highlight ? <span key={safe.updatedAt} className="mfw-pulse" aria-hidden="true" /> : null}

      {banner ? (
        <ExecutiveBanner
          title={safe.title}
          meta={meta}
          kpis={safe.kpis}
          highlights={highlights}
          titleNode={titleNode}
          actions={headerActions}
        />
      ) : (
        <SpecHeader title={safe.title} meta={meta} titleNode={titleNode} actions={headerActions} />
      )}

      {collapsed ? null : (
        <>
          {banner ? null : renderKpis(safe)}

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
            <EmptyState title="No overview charts yet" hint="Add up to four charts that compare categories." />
          )}

          {banner ? null : (
            <InsightBlock
              label="AI Intelligence"
              items={highlights}
              caption="Written by the agent through compose_overview, not by this page."
              numbered
            />
          )}
          {footer}
        </>
      )}
    </section>
  );
}

function renderKpis(spec: OverviewSpec): ReactNode {
  if (spec.kpis.length > 0) return <KpiGrid kpis={spec.kpis} />;
  return (
    <EmptyState
      title="No overview KPIs yet"
      hint="compose_overview takes up to six numbers that span every category."
    />
  );
}
