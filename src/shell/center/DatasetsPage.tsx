/**
 * Datasets: the files dropped into this tab, what the agent can see of them, and the
 * aggregates it asked for. The rows never leave this browser, which is also why a second
 * browser in the same room cannot query them.
 */
import { DropZone } from "../../dataset";
import { useWorkspace } from "../context";
import { SummaryTable } from "../tabs/board/SummaryTable";

const LEAD =
  "A dropped file is parsed here. The agent sees the column profile and the aggregates it asks for, never the rows.";

function StoredAggregates(): JSX.Element | null {
  const workspace = useWorkspace();
  const withSummary = Object.values(workspace.categories).filter((category) => category.summary);
  if (withSummary.length === 0) return null;
  return (
    <section className="mfw-card" aria-label="Stored aggregates">
      <h3>Aggregates the agent stored</h3>
      {withSummary.map((category) =>
        category.summary === undefined ? null : (
          <div className="mfw-ds__block" key={category.name}>
            <p className="mfw-notes__label">{category.name}</p>
            <SummaryTable summary={category.summary} caption={`Aggregates for ${category.name}`} />
          </div>
        ),
      )}
    </section>
  );
}

export function DatasetsPage(): JSX.Element {
  return (
    <div className="mfw-page">
      <section className="mfw-card">
        <h2 className="mfw-page__title">Datasets</h2>
        <p className="mfw-muted">{LEAD}</p>
        <DropZone />
      </section>
      <StoredAggregates />
    </div>
  );
}
