/**
 * One category, full width: its dashboard with every human control, the stored
 * aggregates underneath, and the notes slot for the agent. A category that has
 * aggregates but no dashboard shows the numbers plus the prompt that builds one.
 */

import { DashboardView, categoryIcon } from "../../../dsl";
import { ClaimBadge } from "../../../turns/ui";
import type { Category, Chart } from "../../../types";
import { AskAgentButton } from "./AskAgentButton";
import { ChartPanel } from "./ChartPanel";
import { DropPanel } from "./DropPanel";
import { EditableTitle } from "./EditableTitle";
import { FeedbackSlot } from "./FeedbackSlot";
import { SummaryTable, summaryFacts } from "./SummaryTable";
import type { BoardEdits } from "./useBoardEdits";
import { buildDashboardPrompt, chartPrompt, dashboardPrompt, firstDashboardPrompt } from "./prompts";
import "./board.css";

export interface CategoryPaneProps {
  readonly category: Category;
  readonly readOnly: boolean;
  readonly pinned: boolean;
  readonly edits: BoardEdits;
  readonly onPin: (name: string) => void;
}

export function CategoryPane(props: CategoryPaneProps): JSX.Element {
  const { category, readOnly } = props;
  return (
    <div className="mfw-pane">
      {category.dashboard ? <DashboardSection {...props} /> : <PendingSection {...props} />}
      {category.summary ? (
        <section className="mfw-card" aria-label={`Stored aggregates for ${category.name}`}>
          <p className="mfw-notes__label">Stored aggregates</p>
          <SummaryTable summary={category.summary} caption={`Aggregates for ${category.name}`} />
        </section>
      ) : null}
      <DropPanel readOnly={readOnly} compactFor={category.name} />
      {category.dashboard ? null : (
        <FeedbackSlot target={{ kind: "dashboard", id: category.name }} readOnly={readOnly} />
      )}
    </div>
  );
}

function DashboardSection({ category, readOnly, pinned, edits, onPin }: CategoryPaneProps): JSX.Element {
  const spec = category.dashboard;
  if (!spec) return <PendingSection {...{ category, readOnly, pinned, edits, onPin }} />;
  const target = { kind: "dashboard", category: category.name } as const;
  const count = spec.charts.length;

  const renderChart = (chart: Chart, chartId: string, index: number): JSX.Element => (
    <ChartPanel
      key={chartId}
      chart={chart}
      chartId={chartId}
      index={index}
      count={count}
      prompt={chartPrompt(category.name, chart.title)}
      readOnly={readOnly}
      onMove={(at, delta) => edits.move(target, at, delta)}
      onDelete={(at) => edits.remove(target, at)}
      onKeep={(at, next) => edits.keep(target, at, next)}
    />
  );

  return (
    <DashboardView
      spec={spec}
      titleNode={
        <EditableTitle
          value={spec.title?.trim() || spec.category}
          readOnly={readOnly}
          label={`the ${category.name} dashboard`}
          onSave={(title) => edits.rename(target, title)}
        />
      }
      headerActions={
        readOnly ? null : (
          <>
            <ClaimBadge target={{ kind: "dashboard", id: category.name }} />
            <PinButton name={category.name} pinned={pinned} onPin={onPin} />
            <AskAgentButton prompt={dashboardPrompt(category.name)} />
          </>
        )
      }
      renderChart={renderChart}
      footer={<FeedbackSlot target={{ kind: "dashboard", id: category.name }} readOnly={readOnly} />}
    />
  );
}

function PendingSection({ category, readOnly, pinned, onPin }: CategoryPaneProps): JSX.Element {
  const facts = category.summary ? summaryFacts(category.summary) : [];
  const prompt = category.summary
    ? buildDashboardPrompt(category.name, facts)
    : firstDashboardPrompt(category.name);

  return (
    <section className="mfw-card mfw-pane__empty" aria-label={`Category ${category.name}`}>
      <div className="mfw-pane__head">
        <span className="mfw-cat__icon" aria-hidden="true">
          {categoryIcon(category.name).glyph}
        </span>
        <div className="mfw-pane__main">
          <h2 className="mfw-pane__title">{category.name}</h2>
          <p className="mfw-muted">
            {category.summary
              ? "Aggregates are stored for this category, but no dashboard has been built from them yet."
              : "Nothing is stored for this category yet."}
          </p>
        </div>
        {readOnly ? null : (
          <div className="mfw-pane__actions">
            <ClaimBadge target={{ kind: "dashboard", id: category.name }} />
            <PinButton name={category.name} pinned={pinned} onPin={onPin} />
            <AskAgentButton prompt={prompt} label="Ask ChatGPT to build this dashboard" />
          </div>
        )}
      </div>
    </section>
  );
}

function PinButton({
  name,
  pinned,
  onPin,
}: {
  readonly name: string;
  readonly pinned: boolean;
  readonly onPin: (name: string) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={pinned ? "mfw-pinbtn mfw-pinbtn--on" : "mfw-pinbtn"}
      onClick={() => onPin(name)}
      aria-pressed={pinned}
      title={pinned ? "Unpin category" : "Pin category"}
    >
      {"★"} {pinned ? "Pinned" : "Pin"}
    </button>
  );
}
