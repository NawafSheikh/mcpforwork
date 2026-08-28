/** The power user view: the same policy as JSON, checked against the tool schema. */
export interface JsonPanelProps {
  readonly id: string;
  readonly text: string;
  readonly errors: readonly string[];
  readonly onChange: (next: string) => void;
}

export function JsonPanel({ id, text, errors, onChange }: JsonPanelProps): JSX.Element {
  return (
    <div className="mfw-pf-field">
      <label className="mfw-label" htmlFor={id}>
        Policy JSON
      </label>
      <textarea
        id={id}
        className="mfw-textarea"
        spellCheck={false}
        rows={12}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
      {errors.length > 0 ? (
        <ul className="mfw-pf-errors">
          {errors.map((error) => (
            <li className="mfw-danger" key={error}>
              {error}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mfw-pf-hint">Valid. The form above has the same clauses.</p>
      )}
    </div>
  );
}
