/**
 * Renders a DashboardSpec: title, up to four KPI cards, then the charts.
 * The spec is clamped first, so an over-eager agent can never blow up the page.
 */

import { useMemo } from "react";
import type { DashboardSpec } from "../types";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";
import { KpiGrid } from "./KpiCard";
import { BulletList, SpecHeader } from "./SpecHeader";
import { chartKey, clampDashboard, describeDashboard } from "./validate";
import "./styles.css";

export interface DashboardViewProps {
  readonly spec: DashboardSpec;
  /** Called with the chart id (or "chart-<index>") when a human wants to edit one. */
  readonly onEdit?: (chartId: string) => void;
  /** Pulses the card border once for 1.5s after the agent updated this spec. */
  readonly highlight?: boolean;
}

export function DashboardView({ spec, onEdit, highlight = false }: DashboardViewProps) {
  const safe = useMemo(() => clampDashboard(spec), [spec]);
  const title = safe.title && safe.title.trim() ? safe.title : safe.category;
  const notes = safe.notes ?? [];

  return (
    <section className="mfw-dsl mfw-surface" aria-label={`Dashboard for ${safe.category}`}>
      {highlight ? <span key={safe.updatedAt} className="mfw-pulse" aria-hidden="true" /> : null}
      <SpecHeader title={title} meta={describeDashboard(safe)} source={safe.source} />

      {safe.kpis.length > 0 ? (
        <KpiGrid kpis={safe.kpis} />
      ) : (
        <EmptyState
          title="No KPIs yet"
          hint="Ask your agent to call upsert_dashboard with up to four headline numbers."
        />
      )}

      {safe.charts.length > 0 ? (
        <div className="mfw-grid">
          {safe.charts.map((chart, index) => (
            <ChartCard
              key={chartKey(chart, index)}
              chart={chart}
              chartId={chartKey(chart, index)}
              onEdit={onEdit}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No charts yet" hint="Charts arrive as bar, line, donut or table specs." />
      )}

      {notes.length > 0 ? <BulletList label="Notes" items={notes} /> : null}
    </section>
  );
}
