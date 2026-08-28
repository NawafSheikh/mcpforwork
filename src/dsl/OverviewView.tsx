/**
 * Renders an OverviewSpec: the cross-category board with up to six KPIs,
 * the same chart grid as a dashboard, and the agent's highlights.
 */

import { useMemo } from "react";
import type { OverviewSpec } from "../types";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";
import { KpiGrid } from "./KpiCard";
import { BulletList, SpecHeader } from "./SpecHeader";
import { chartKey, clampOverview, describeOverview } from "./validate";
import "./styles.css";

export interface OverviewViewProps {
  readonly spec: OverviewSpec;
  /** Called with the chart id (or "chart-<index>") when a human wants to edit one. */
  readonly onEdit?: (chartId: string) => void;
  /** Pulses the card border once for 1.5s after the agent updated this spec. */
  readonly highlight?: boolean;
}

export function OverviewView({ spec, onEdit, highlight = false }: OverviewViewProps) {
  const safe = useMemo(() => clampOverview(spec), [spec]);
  const highlights = safe.highlights ?? [];

  return (
    <section className="mfw-dsl mfw-surface" aria-label="Workspace overview">
      {highlight ? <span key={safe.updatedAt} className="mfw-pulse" aria-hidden="true" /> : null}
      <SpecHeader title={safe.title} meta={describeOverview(safe)} />

      {safe.kpis.length > 0 ? (
        <KpiGrid kpis={safe.kpis} />
      ) : (
        <EmptyState
          title="No overview KPIs yet"
          hint="compose_overview takes up to six numbers that span every category."
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
        <EmptyState title="No overview charts yet" hint="Add up to four charts that compare categories." />
      )}

      {highlights.length > 0 ? <BulletList label="Highlights" items={highlights} /> : null}
    </section>
  );
}
