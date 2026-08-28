/** Board: the overview on top, then one dashboard per category. */
import { CategoryPanel, DashboardPanel, OverviewPanel } from "../adapters/dsl";
import { useWorkspace } from "../context";
import { formatRelative } from "../lib/format";
import { EmptyState } from "./EmptyState";
import type { Category } from "../../types";

function SummaryChips({ category }: { readonly category: Category }): JSX.Element | null {
  const counts = category.summary?.counts;
  if (!counts) return null;
  return (
    <div className="mfw-chips">
      {Object.entries(counts).map(([key, value]) => (
        <span className="mfw-chip" key={key}>
          {key}: {value}
        </span>
      ))}
    </div>
  );
}

function CategoryTile({ category }: { readonly category: Category }): JSX.Element {
  return (
    <CategoryPanel category={category}>
      {category.dashboard ? (
        <>
          <DashboardPanel spec={category.dashboard} />
          <p className="mfw-stamp">Updated {formatRelative(category.dashboard.updatedAt)}</p>
        </>
      ) : (
        <div className="mfw-pending-dash">
          <SummaryChips category={category} />
          <p className="mfw-muted">
            No dashboard yet. Ask ChatGPT to call upsert_dashboard for this category.
          </p>
        </div>
      )}
    </CategoryPanel>
  );
}

export function BoardTab(): JSX.Element {
  const workspace = useWorkspace();
  const categories = Object.values(workspace.categories);

  if (categories.length === 0 && !workspace.overview) return <EmptyState />;

  return (
    <div className="mfw-board">
      {workspace.overview ? <OverviewPanel spec={workspace.overview} /> : null}
      <div className="mfw-grid">
        {categories.map((category) => (
          <CategoryTile category={category} key={category.name} />
        ))}
      </div>
    </div>
  );
}
