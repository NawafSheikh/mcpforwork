/**
 * The board in the centre column: the overview, or one category, chosen in the left rail.
 *
 * Everything it paints is the existing board (owner A7): the same panes, the same chart
 * controls, the same notes slot. What changed is the frame around them: the category list
 * moved to the rail, so this file only decides which pane is on screen.
 */
import { useCallback, useMemo, useState } from "react";
import { useWorkspace } from "../context";
import { CategoryPane } from "../tabs/board/CategoryPane";
import { OverviewPane } from "../tabs/board/OverviewPane";
import { UndoToast } from "../tabs/board/UndoToast";
import { usePinned } from "../tabs/board/pinned";
import { useBoardEdits, type RemovedChart } from "../tabs/board/useBoardEdits";
import { OVERVIEW, orderedCategories, type Place } from "../lib/places";
import { useNav } from "../nav";
import { HolderRow } from "./HolderRow";
import { PulseChip } from "./PulseChip";

export function BoardHost(): JSX.Element {
  const workspace = useWorkspace();
  const { pinned, toggle } = usePinned(workspace.id);
  const { place, goTo } = useNav();
  const [removed, setRemoved] = useState<RemovedChart | null>(null);

  const onRemoved = useCallback((next: RemovedChart) => setRemoved(next), []);
  const edits = useBoardEdits(onRemoved);
  const categories = useMemo(
    () => orderedCategories(workspace, pinned),
    [workspace, pinned],
  );

  const onPin = useCallback((name: string) => edits.pin(name, toggle(name)), [edits, toggle]);
  const onOpen = useCallback((name: string) => goTo({ kind: "category", name }), [goTo]);

  const current = place.kind === "category" ? workspace.categories[place.name] : undefined;
  const shown: Place = current === undefined ? OVERVIEW : place;

  return (
    <div className="mfw-center__board">
      <PulseChip place={shown} />
      {current === undefined ? (
        <OverviewPane
          overview={workspace.overview}
          categories={categories}
          pinned={pinned}
          readOnly={false}
          edits={edits}
          onOpen={onOpen}
          onPin={onPin}
        />
      ) : (
        <>
          <HolderRow target={{ kind: "dashboard", id: current.name }} />
          <CategoryPane
            category={current}
            readOnly={false}
            pinned={pinned.includes(current.name)}
            edits={edits}
            onPin={onPin}
          />
        </>
      )}
      {removed === null ? null : (
        <UndoToast
          message={`Removed "${removed.chart.title}"`}
          onUndo={() => {
            edits.restore(removed);
            setRemoved(null);
          }}
          onDismiss={() => setRemoved(null)}
        />
      )}
    </div>
  );
}
