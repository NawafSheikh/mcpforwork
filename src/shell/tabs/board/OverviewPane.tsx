/**
 * The overview view: the executive banner the agent composed, its charts, and
 * the same category list as the sidebar rendered as clickable domain cards.
 */

import { OverviewView } from "../../../dsl";
import type { Category, Chart, OverviewSpec } from "../../../types";
import { AskAgentButton } from "./AskAgentButton";
import { ChartPanel } from "./ChartPanel";
import { DomainGrid } from "./DomainGrid";
import { EditableTitle } from "./EditableTitle";
import { FeedbackSlot } from "./FeedbackSlot";
import type { BoardEdits } from "./useBoardEdits";
import { overviewChartPrompt, overviewPrompt } from "./prompts";
import "./board.css";

const TARGET = { kind: "overview" } as const;

export interface OverviewPaneProps {
  readonly overview?: OverviewSpec;
  readonly categories: readonly Category[];
  readonly pinned: readonly string[];
  readonly readOnly: boolean;
  readonly edits: BoardEdits;
  readonly onOpen: (name: string) => void;
  readonly onPin: (name: string) => void;
}

export function OverviewPane(props: OverviewPaneProps): JSX.Element {
  const { overview, categories, pinned, readOnly, onOpen, onPin } = props;
  return (
    <div className="mfw-pane">
      {overview ? <OverviewSection {...props} spec={overview} /> : <NoOverview readOnly={readOnly} />}
      <DomainGrid
        categories={categories}
        onOpen={onOpen}
        pinned={pinned}
        onPin={readOnly ? undefined : onPin}
      />
    </div>
  );
}

function OverviewSection({
  spec,
  readOnly,
  edits,
}: OverviewPaneProps & { readonly spec: OverviewSpec }): JSX.Element {
  const count = spec.charts.length;
  const renderChart = (chart: Chart, chartId: string, index: number): JSX.Element => (
    <ChartPanel
      key={chartId}
      chart={chart}
      chartId={chartId}
      index={index}
      count={count}
      prompt={overviewChartPrompt(chart.title)}
      readOnly={readOnly}
      onMove={(at, delta) => edits.move(TARGET, at, delta)}
      onDelete={(at) => edits.remove(TARGET, at)}
      onKeep={(at, next) => edits.keep(TARGET, at, next)}
    />
  );

  return (
    <OverviewView
      spec={spec}
      banner
      titleNode={
        <EditableTitle
          value={spec.title}
          readOnly={readOnly}
          className="mfw-banner__title"
          label="the overview"
          onSave={(title) => edits.rename(TARGET, title)}
        />
      }
      headerActions={
        readOnly ? null : <AskAgentButton prompt={overviewPrompt()} label="Ask the agent" />
      }
      renderChart={renderChart}
      footer={<FeedbackSlot target={{ kind: "overview", id: "overview" }} readOnly={readOnly} />}
    />
  );
}

function NoOverview({ readOnly }: { readonly readOnly: boolean }): JSX.Element {
  return (
    <section className="mfw-card mfw-pane__empty">
      <h2 className="mfw-pane__title">No overview yet</h2>
      <p className="mfw-muted">
        The overview is the one board that spans every category. The agent composes it once the
        categories have dashboards.
      </p>
      {readOnly ? null : <AskAgentButton prompt={overviewPrompt()} label="Copy the prompt" />}
    </section>
  );
}
