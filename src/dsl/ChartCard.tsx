/**
 * One chart in its own card: title, optional note, optional edit affordance,
 * and a 220px body that dispatches on the chart kind.
 */

import type { ReactNode } from "react";
import type { Chart } from "../types";
import { BarChartView, DonutChartView, LineChartView, TableView } from "./charts";
import { EmptyState } from "./EmptyState";
import "./styles.css";

export interface ChartCardProps {
  readonly chart: Chart;
  readonly chartId: string;
  readonly onEdit?: (chartId: string) => void;
}

export function ChartCard({ chart, chartId, onEdit }: ChartCardProps) {
  return (
    <article className={`mfw-card mfw-chart mfw-chart--${chart.kind}`} data-chart-id={chartId}>
      <header className="mfw-chart__head">
        <div>
          <h3 className="mfw-chart__title">{chart.title}</h3>
          {chart.note ? <p className="mfw-chart__note">{chart.note}</p> : null}
        </div>
        {onEdit ? (
          <button
            type="button"
            className="mfw-edit"
            onClick={() => onEdit(chartId)}
            aria-label={`Edit ${chart.title}`}
          >
            Edit
          </button>
        ) : null}
      </header>
      <div className="mfw-chart__body">{renderBody(chart)}</div>
    </article>
  );
}

/** True when there is nothing to draw, so the card shows a reason instead. */
export function isChartEmpty(chart: Chart): boolean {
  const points = chart.points ?? [];
  if (chart.kind !== "table") return points.length === 0;
  return (chart.rows ?? []).length === 0 && points.length === 0;
}

function renderBody(chart: Chart): ReactNode {
  if (isChartEmpty(chart)) {
    return <EmptyState title="No data points yet" hint="The agent can add them with upsert_dashboard." inline />;
  }
  const points = chart.points ?? [];
  switch (chart.kind) {
    case "bar":
      return <BarChartView points={points} />;
    case "line":
      return <LineChartView points={points} />;
    case "donut":
      return <DonutChartView points={points} />;
    case "table":
      return <TableView columns={chart.columns} rows={chart.rows} points={points} caption={chart.title} />;
    default:
      return <EmptyState title="Unknown chart kind" hint="Use bar, line, donut or table." inline />;
  }
}
