/** The small picker that fills {{threads}} and {{category}} at copy time. */
import type { TemplateVarName } from "../template";
import type { TemplateVars } from "../types";

export interface VarsPickerProps {
  readonly idBase: string;
  readonly used: readonly TemplateVarName[];
  readonly vars: TemplateVars;
  readonly onChange: (next: TemplateVars) => void;
}

export function VarsPicker({ idBase, used, vars, onChange }: VarsPickerProps): JSX.Element | null {
  if (used.length === 0) return null;
  return (
    <div className="mfw-pl-vars">
      {used.includes("threads") ? (
        <label className="mfw-pl-var" htmlFor={`${idBase}-threads`}>
          <span>threads</span>
          <input
            id={`${idBase}-threads`}
            className="mfw-pl-var-input mfw-pl-var-number"
            type="number"
            min={1}
            max={200}
            value={vars.threads === undefined ? "" : String(vars.threads)}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onChange({ ...vars, threads: Number.isFinite(parsed) ? parsed : undefined });
            }}
          />
        </label>
      ) : null}
      {used.includes("category") ? (
        <label className="mfw-pl-var" htmlFor={`${idBase}-category`}>
          <span>category</span>
          <input
            id={`${idBase}-category`}
            className="mfw-pl-var-input"
            type="text"
            value={vars.category ?? ""}
            placeholder="Invoices"
            onChange={(event) => onChange({ ...vars, category: event.target.value })}
          />
        </label>
      ) : null}
    </div>
  );
}
