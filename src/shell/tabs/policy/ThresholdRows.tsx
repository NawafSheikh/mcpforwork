/** Thresholds as rows: field, operator, number, optional label. */
import type { ThresholdOp } from "../../../types";
import { CAPS, FIELD_SUGGESTIONS, OPS, OP_SYMBOLS, type ThresholdRow } from "./model";

const FIELD_LIST_ID = "mfw-threshold-fields";

export interface ThresholdRowsProps {
  readonly rows: readonly ThresholdRow[];
  readonly onPatch: (id: string, patch: Partial<ThresholdRow>) => void;
  readonly onRemove: (id: string) => void;
  readonly onAdd: () => void;
}

function Row({
  row,
  index,
  onPatch,
  onRemove,
}: {
  readonly row: ThresholdRow;
  readonly index: number;
  readonly onPatch: (id: string, patch: Partial<ThresholdRow>) => void;
  readonly onRemove: (id: string) => void;
}): JSX.Element {
  const position = index + 1;
  return (
    <li className="mfw-pf-row">
      <input
        className="mfw-pf-input mfw-pf-row-field"
        type="text"
        list={FIELD_LIST_ID}
        value={row.field}
        aria-label={`Rule ${position} field`}
        placeholder="amount"
        onChange={(event) => onPatch(row.id, { field: event.target.value })}
      />
      <select
        className="mfw-pf-select"
        value={row.op}
        aria-label={`Rule ${position} comparison`}
        onChange={(event) => onPatch(row.id, { op: event.target.value as ThresholdOp })}
      >
        {OPS.map((op) => (
          <option key={op} value={op}>
            {OP_SYMBOLS[op]}
          </option>
        ))}
      </select>
      <input
        className="mfw-pf-input mfw-pf-row-value"
        type="text"
        inputMode="decimal"
        value={row.value}
        aria-label={`Rule ${position} value`}
        placeholder="5000"
        onChange={(event) => onPatch(row.id, { value: event.target.value })}
      />
      <input
        className="mfw-pf-input mfw-pf-row-label"
        type="text"
        value={row.label}
        maxLength={CAPS.labelChars}
        aria-label={`Rule ${position} label`}
        placeholder="Label (optional)"
        onChange={(event) => onPatch(row.id, { label: event.target.value })}
      />
      <button
        type="button"
        className="mfw-pf-chip-x"
        aria-label={`Remove rule ${position}`}
        onClick={() => onRemove(row.id)}
      >
        x
      </button>
    </li>
  );
}

export function ThresholdRows({
  rows,
  onPatch,
  onRemove,
  onAdd,
}: ThresholdRowsProps): JSX.Element {
  return (
    <div className="mfw-pf-field">
      <span className="mfw-label">Hold anything that trips a rule</span>
      <datalist id={FIELD_LIST_ID}>
        {FIELD_SUGGESTIONS.map((field) => (
          <option key={field} value={field} />
        ))}
      </datalist>
      {rows.length === 0 ? (
        <p className="mfw-pf-hint">No rules yet, so no amount is held on its own.</p>
      ) : (
        <ul className="mfw-pf-rows">
          {rows.map((row, index) => (
            <Row key={row.id} row={row} index={index} onPatch={onPatch} onRemove={onRemove} />
          ))}
        </ul>
      )}
      <button
        type="button"
        className="mfw-btn"
        disabled={rows.length >= CAPS.thresholds}
        onClick={onAdd}
      >
        Add rule
      </button>
    </div>
  );
}
