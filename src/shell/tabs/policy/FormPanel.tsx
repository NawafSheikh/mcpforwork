/**
 * The guardrail form. Every control writes one clause of a Policy, and the words
 * around them are the ones a person signing off on a run would use.
 */
import { CAPS, CHIP_CAPS, addChip, emptyRow, removeChip } from "./model";
import type { ChipListName, PolicyForm, ThresholdRow } from "./model";
import { ChipList } from "./ChipList";
import { Stepper } from "./Stepper";
import { ThresholdRows } from "./ThresholdRows";

export interface FormPanelProps {
  readonly idBase: string;
  readonly form: PolicyForm;
  readonly onChange: (next: PolicyForm) => void;
}

const CHIP_COPY: Readonly<
  Record<ChipListName, { title: string; hint: string; placeholder: string }>
> = {
  requireHumanFor: {
    title: "Always ask a human for",
    hint: "Matched on the action kind, exactly. An action of this kind never runs itself.",
    placeholder: "pay",
  },
  allowlist: {
    title: "Safe to run without asking",
    hint: "Matched on the action kind or target, exactly. Everything else still waits.",
    placeholder: "tag_record",
  },
  denylist: {
    title: "Never run, always hold",
    hint: "Matched anywhere in the kind or the target, so a broad word holds a lot.",
    placeholder: "payment",
  },
};

export function FormPanel({ idBase, form, onChange }: FormPanelProps): JSX.Element {
  const patchRow = (id: string, patch: Partial<ThresholdRow>): void => {
    onChange({
      ...form,
      thresholds: form.thresholds.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  };

  const chip = (name: ChipListName): JSX.Element => (
    <ChipList
      id={`${idBase}-${name}`}
      title={CHIP_COPY[name].title}
      hint={CHIP_COPY[name].hint}
      placeholder={CHIP_COPY[name].placeholder}
      values={form[name]}
      max={CHIP_CAPS[name]}
      onAdd={(entry) => onChange({ ...form, [name]: addChip(form[name], entry, CHIP_CAPS[name]) })}
      onRemove={(entry) => onChange({ ...form, [name]: removeChip(form[name], entry) })}
    />
  );

  return (
    <div className="mfw-pf">
      <Stepper
        id={`${idBase}-max`}
        value={form.maxAutoActionsPerRun}
        onChange={(next) => onChange({ ...form, maxAutoActionsPerRun: next })}
      />
      <ThresholdRows
        rows={form.thresholds}
        onPatch={patchRow}
        onAdd={() => onChange({ ...form, thresholds: [...form.thresholds, emptyRow()] })}
        onRemove={(id) =>
          onChange({ ...form, thresholds: form.thresholds.filter((row) => row.id !== id) })
        }
      />
      {chip("requireHumanFor")}
      {chip("allowlist")}
      {chip("denylist")}
      <div className="mfw-pf-field">
        <label className="mfw-label" htmlFor={`${idBase}-notes`}>
          Notes
        </label>
        <textarea
          id={`${idBase}-notes`}
          className="mfw-textarea mfw-pf-notes"
          rows={2}
          maxLength={CAPS.notesChars}
          value={form.notes}
          placeholder="Why this policy looks the way it does"
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
        />
      </div>
    </div>
  );
}
