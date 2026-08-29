/**
 * Places: the overview, every category with what it holds, and the pages. Pinned first,
 * badges for what is waiting. Selecting one swaps the centre column in React state, so
 * the tools registered on this page are never unloaded by moving around.
 */
import { addressedFeedback } from "../../feedback";
import { useDatasets } from "../../dataset";
import { useWorkspace } from "../context";
import { placeRows, samePlace, type PlaceRow } from "../lib/places";
import { usePinned } from "../tabs/board/pinned";
import { useNav } from "../nav";

function Row({ row, active, onSelect }: {
  readonly row: PlaceRow;
  readonly active: boolean;
  readonly onSelect: () => void;
}): JSX.Element {
  return (
    <li>
      <button
        type="button"
        className={active ? "mfw-place mfw-place--on" : "mfw-place"}
        aria-current={active ? "true" : undefined}
        onClick={onSelect}
      >
        <span className="mfw-place__body">
          <span className="mfw-place__name">
            {row.pinned ? (
              <span className="mfw-place__pin" aria-label="pinned">
                {"\u2605"}
              </span>
            ) : null}
            {row.label}
          </span>
          <span className="mfw-place__meta">{row.meta}</span>
        </span>
        {row.badge === undefined ? null : <span className="mfw-req-badge">{row.badge}</span>}
      </button>
    </li>
  );
}

export function Places(): JSX.Element {
  const workspace = useWorkspace();
  const { pinned } = usePinned(workspace.id);
  const datasets = useDatasets();
  const { place, goTo } = useNav();

  const rows = placeRows(workspace, pinned, {
    openRequests: addressedFeedback(workspace).length,
    heldDrafts: Object.values(workspace.drafts).filter((draft) => draft.status === "held").length,
    datasets: datasets.length,
  });

  return (
    <nav className="mfw-rail__block" aria-label="Places">
      <h2 className="mfw-rail__title">Places</h2>
      <ul className="mfw-places">
        {rows.map((row) => (
          <Row
            key={row.id}
            row={row}
            active={samePlace(row.place, place)}
            onSelect={() => goTo(row.place)}
          />
        ))}
      </ul>
    </nav>
  );
}
