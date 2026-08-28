/**
 * One chart in its own card: title, optional note, optional human controls,
 * and a 220px body that dispatches on the chart kind.
 */

import type { ReactNode } from "react";
import type { Chart } from "../types";
import { BarChartView, DonutChartView, LineChartView, TableView } from "./charts";
import { EmptyState } from "./EmptyState";
import { chartCaption } from "./insights";
import "./styles.css";

export interface ChartCardProps {
  readonly chart: Chart;
  readonly chartId: string;
  readonly onEdit?: (chartId: string) => void;
  /** Controls on the header row: reorder, delete, ask the agent. */
  readonly actions?: ReactNode;
  /** Row under the header: kind switcher and sort toggle. */
  readonly toolbar?: ReactNode;
}

export function ChartCard({ chart, chartId, onEdit, actions, toolbar }: ChartCardProps) {
  const caption = chartCaption(chart);
  return (
    <article className={`mfw-card mfw-chart mfw-chart--${chart.kind}`} data-chart-id={chartId}>
      <header className="mfw-chart__head">
        <div className="mfw-chart__heading">
          <h3 className="mfw-chart__title">{chart.title}</h3>
          {caption ? <p className="mfw-chart__note">{caption}</p> : null}
        </div>
        <div className="mfw-chart__actions">
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
          {actions}
        </div>
      </header>
      {toolbar ? <div className="mfw-chart__toolbar">{toolbar}</div> : null}
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
