/**
 * The board: category navigation on the left, one view at a time on the right.
 * Selection is React state, never navigation, so the tools registered on this
 * page survive every switch. readOnly is what a shared snapshot renders with:
 * no editing, no notes input, no prompts to copy.
 */

import { useCallback, useMemo, useState } from "react";
import { useWorkspace } from "../../context";
import { CategoryNav, OVERVIEW_ID } from "./CategoryNav";
import { CategoryPane } from "./CategoryPane";
import { DropPanel } from "./DropPanel";
import { OverviewPane } from "./OverviewPane";
import { UndoToast } from "./UndoToast";
import { sortPinnedFirst, usePinned } from "./pinned";
import { useBoardEdits, type RemovedChart } from "./useBoardEdits";
import type { Category } from "../../../types";
import "./board.css";

export interface BoardProps {
  /** Shared snapshots render the same board with every control removed. */
  readonly readOnly?: boolean;
}

export function Board({ readOnly = false }: BoardProps): JSX.Element {
  const workspace = useWorkspace();
  const { pinned, toggle } = usePinned(workspace.id);
  const [selected, setSelected] = useState<string>(OVERVIEW_ID);
  const [removed, setRemoved] = useState<RemovedChart | null>(null);

  const onRemoved = useCallback((next: RemovedChart) => setRemoved(next), []);
  const edits = useBoardEdits(onRemoved);

  const categories = useMemo(
    () => sortPinnedFirst(byName(Object.values(workspace.categories)), pinned),
    [workspace.categories, pinned],
  );

  const onPin = useCallback(
    (name: string) => edits.pin(name, toggle(name)),
    [edits, toggle],
  );

  // A cold board still takes a file: dropping a CSV is a fine first move, with or without
  // an agent attached. The panel hides itself in readOnly, so a snapshot stays a snapshot.
  if (categories.length === 0 && !workspace.overview) {
    return (
      <>
        <p className="mfw-muted">Nothing on this board yet.</p>
        <DropPanel readOnly={readOnly} />
      </>
    );
  }

  const current = categories.find((category) => category.name === selected);

  return (
    <div className="mfw-board2">
      <CategoryNav
        categories={categories}
        selected={current ? current.name : OVERVIEW_ID}
        onSelect={setSelected}
        pinned={pinned}
      />

      <div className="mfw-board2__main">
        {current ? (
          <CategoryPane
            category={current}
            readOnly={readOnly}
            pinned={pinned.includes(current.name)}
            edits={edits}
            onPin={onPin}
          />
        ) : (
          <OverviewPane
            overview={workspace.overview}
            categories={categories}
            pinned={pinned}
            readOnly={readOnly}
            edits={edits}
            onOpen={setSelected}
            onPin={onPin}
          />
        )}
      </div>

      {removed ? (
        <UndoToast
          message={`Removed "${removed.chart.title}"`}
          onUndo={() => {
            edits.restore(removed);
            setRemoved(null);
          }}
          onDismiss={() => setRemoved(null)}
        />
      ) : null}
    </div>
  );
}

function byName(categories: readonly Category[]): readonly Category[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}
