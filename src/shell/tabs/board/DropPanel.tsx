/**
 * The board's mount point for src/dataset (wiring per src/dataset/INTEGRATION.md).
 *
 * Full width on the overview, under the executive summary and above the category grid.
 * Folded away on a category page, so the dashboard stays the first thing a visitor reads.
 * Never rendered read only: a shared snapshot carries no rows and registers no tools to
 * read them with, so a drop zone there would be a promise the page cannot keep.
 */

import { DropZone } from "../../../dataset";
import "./board.css";

const HEADLINE = "Drop a CSV or XLSX";

export interface DropPanelProps {
  readonly readOnly: boolean;
  /** Category pages pass their name and get the folded variant. */
  readonly compactFor?: string;
}

export function DropPanel({ readOnly, compactFor }: DropPanelProps): JSX.Element | null {
  if (readOnly) return null;
  if (compactFor === undefined) {
    return (
      <section className="mfw-card mfw-drop" aria-label={HEADLINE}>
        <p className="mfw-notes__label">{HEADLINE}</p>
        <DropZone />
      </section>
    );
  }
  return (
    <details className="mfw-card mfw-drop">
      <summary className="mfw-drop__summary">{`${HEADLINE} for ${compactFor}`}</summary>
      <DropZone />
    </details>
  );
}
