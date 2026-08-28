/**
 * One chart with its human controls: reorder, delete, ask the agent, and the
 * view switchers. Switching kind or sort is a local look at the same points and
 * never touches the store; "Keep" is the one control that writes, and it is
 * audited as a human edit like everything else on the board.
 */

import { useMemo, useState } from "react";
import { ChartCard, SWITCHABLE_KINDS, applyChartView, canSort, canSwitchKind } from "../../../dsl";
import type { ChartView, SortMode } from "../../../dsl";
import type { Chart, ChartKind } from "../../../types";
import { AskAgentButton } from "./AskAgentButton";
import "./board.css";

const SORTS: readonly (readonly [SortMode, string])[] = [
  ["none", "As sent"],
  ["value", "By value"],
  ["label", "By label"],
];

export interface ChartPanelProps {
  readonly chart: Chart;
  readonly chartId: string;
  readonly index: number;
  readonly count: number;
  readonly prompt: string;
  readonly readOnly: boolean;
  readonly onMove: (index: number, delta: number) => void;
  readonly onDelete: (index: number) => void;
  readonly onKeep: (index: number, chart: Chart) => void;
}

export function ChartPanel(props: ChartPanelProps): JSX.Element {
  const { chart, chartId, index, count, prompt, readOnly } = props;
  const [view, setView] = useState<ChartView>({});
  const shown = useMemo(() => applyChartView(chart, view), [chart, view]);
  // applyChartView returns the stored chart itself when the view changes nothing,
  // so identity is the honest test for "there is something worth keeping".
  const changed = shown !== chart;

  return (
    <ChartCard
      key={chartId}
      chart={shown}
      chartId={chartId}
      actions={readOnly ? null : <ChartActions {...props} />}
      toolbar={
        <ChartToolbar
          chart={chart}
          kind={shown.kind}
          sort={view.sort ?? "none"}
          onView={setView}
          keepable={changed && !readOnly}
          onKeep={() => {
            props.onKeep(index, shown);
            setView({});
          }}
        />
      }
    />
  );
}

function ChartActions({
  chart,
  index,
  count,
  prompt,
  onMove,
  onDelete,
}: ChartPanelProps): JSX.Element {
  return (
    <>
      <button
        type="button"
        className="mfw-icobtn"
        disabled={index === 0}
        onClick={() => onMove(index, -1)}
        aria-label={`Move ${chart.title} up`}
        title="Move up"
      >
        {"↑"}
      </button>
      <button
        type="button"
        className="mfw-icobtn"
        disabled={index >= count - 1}
        onClick={() => onMove(index, 1)}
        aria-label={`Move ${chart.title} down`}
        title="Move down"
      >
        {"↓"}
      </button>
      <button
        type="button"
        className="mfw-icobtn mfw-icobtn--danger"
        onClick={() => onDelete(index)}
        aria-label={`Delete ${chart.title}`}
        title="Delete chart"
      >
        {"✕"}
      </button>
      <AskAgentButton prompt={prompt} label="Ask" small title={prompt} />
    </>
  );
}

interface ToolbarProps {
  readonly chart: Chart;
  readonly kind: ChartKind;
  readonly sort: SortMode;
  readonly onView: (view: ChartView) => void;
  readonly keepable: boolean;
  readonly onKeep: () => void;
}

function ChartToolbar({ chart, kind, sort, onView, keepable, onKeep }: ToolbarProps): JSX.Element | null {
  const switchable = canSwitchKind(chart) && chart.kind !== "table";
  const sortable = canSort(chart, kind);
  if (!switchable && !sortable) return null;

  return (
    <>
      {switchable ? (
        <div className="mfw-seg" role="group" aria-label={`Chart kind for ${chart.title}`}>
          {SWITCHABLE_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              className={option === kind ? "mfw-seg__btn mfw-seg__btn--on" : "mfw-seg__btn"}
              aria-pressed={option === kind}
              onClick={() => onView({ kind: option, sort })}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}

      {sortable ? (
        <div className="mfw-seg" role="group" aria-label={`Sort ${chart.title}`}>
          {SORTS.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={mode === sort ? "mfw-seg__btn mfw-seg__btn--on" : "mfw-seg__btn"}
              aria-pressed={mode === sort}
              onClick={() => onView({ kind, sort: mode })}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {keepable ? (
        <button type="button" className="mfw-keep" onClick={onKeep} title="Save this view to the dashboard">
          Keep this view
        </button>
      ) : null}
    </>
  );
}
