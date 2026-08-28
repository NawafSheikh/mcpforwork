/** Max auto actions per run: the one number that decides how much runs unattended. */
import { MAX_AUTO_ACTIONS, autoActionsSentence } from "./model";

export interface StepperProps {
  readonly id: string;
  readonly value: number;
  readonly onChange: (next: number) => void;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_AUTO_ACTIONS, Math.max(0, Math.floor(value)));
}

export function Stepper({ id, value, onChange }: StepperProps): JSX.Element {
  return (
    <div className="mfw-pf-field">
      <label className="mfw-label" htmlFor={id}>
        Max automatic actions per run
      </label>
      <div className="mfw-pf-stepper">
        <button
          type="button"
          className="mfw-btn mfw-pf-step"
          aria-label="One fewer automatic action"
          disabled={value <= 0}
          onClick={() => onChange(clamp(value - 1))}
        >
          -
        </button>
        <input
          id={id}
          className="mfw-pf-number"
          type="number"
          min={0}
          max={MAX_AUTO_ACTIONS}
          step={1}
          value={String(value)}
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
        />
        <button
          type="button"
          className="mfw-btn mfw-pf-step"
          aria-label="One more automatic action"
          disabled={value >= MAX_AUTO_ACTIONS}
          onClick={() => onChange(clamp(value + 1))}
        >
          +
        </button>
      </div>
      <p className="mfw-pf-hint">{autoActionsSentence(value)}</p>
    </div>
  );
}
