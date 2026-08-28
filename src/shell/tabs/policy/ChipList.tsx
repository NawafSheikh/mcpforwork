/** A list of short terms as chips: type to add, x to remove. */
import { useState } from "react";
import type { FormEvent } from "react";

export interface ChipListProps {
  readonly id: string;
  readonly title: string;
  readonly hint: string;
  readonly placeholder: string;
  readonly values: readonly string[];
  readonly max: number;
  readonly onAdd: (entry: string) => void;
  readonly onRemove: (entry: string) => void;
}

export function ChipList({
  id,
  title,
  hint,
  placeholder,
  values,
  max,
  onAdd,
  onRemove,
}: ChipListProps): JSX.Element {
  const [draft, setDraft] = useState("");
  const full = values.length >= max;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const entry = draft.trim();
    if (entry === "") return;
    onAdd(entry);
    setDraft("");
  };

  return (
    <div className="mfw-pf-field">
      <label className="mfw-label" htmlFor={id}>
        {title}
      </label>
      {values.length > 0 ? (
        <ul className="mfw-pf-chips">
          {values.map((entry) => (
            <li className="mfw-pf-chip" key={entry}>
              <span>{entry}</span>
              <button
                type="button"
                className="mfw-pf-chip-x"
                aria-label={`Remove ${entry}`}
                onClick={() => onRemove(entry)}
              >
                x
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form className="mfw-pf-chip-form" onSubmit={submit}>
        <input
          id={id}
          className="mfw-pf-input"
          type="text"
          value={draft}
          placeholder={full ? `Full at ${max}` : placeholder}
          disabled={full}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="mfw-btn" disabled={full || draft.trim() === ""}>
          Add
        </button>
      </form>
      <p className="mfw-pf-hint">{hint}</p>
    </div>
  );
}
