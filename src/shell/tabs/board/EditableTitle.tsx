/**
 * Click to edit a title in place. Enter saves, Escape cancels, leaving the field
 * commits what is in it. Read only mode renders the plain heading with no
 * affordance at all, which is what a shared snapshot needs.
 */

import { useEffect, useState } from "react";
import "./board.css";

export interface EditableTitleProps {
  readonly value: string;
  readonly onSave: (next: string) => void;
  readonly readOnly?: boolean;
  /** Class for the rendered heading, so the banner and the card can differ. */
  readonly className?: string;
  /** What the field is called, for screen readers. */
  readonly label?: string;
}

export function EditableTitle({
  value,
  onSave,
  readOnly = false,
  className = "mfw-head__title",
  label = "title",
}: EditableTitleProps): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [value]);

  if (readOnly || draft === null) {
    return readOnly ? (
      <h2 className={className}>{value}</h2>
    ) : (
      <button
        type="button"
        className={`${className} mfw-titlebtn`}
        onClick={() => setDraft(value)}
        title={`Rename ${label}`}
      >
        {value}
      </button>
    );
  }

  const commit = (next: string): void => {
    setDraft(null);
    if (next.trim() !== value.trim()) onSave(next);
  };

  return (
    <input
      className={`${className} mfw-titleinput`}
      value={draft}
      aria-label={`Rename ${label}`}
      autoFocus
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit(draft);
        if (event.key === "Escape") setDraft(null);
      }}
    />
  );
}
