/** Policy editor: a JSON textarea with a live diff against the saved policy. */
import { useCallback, useMemo, useState } from "react";
import type { Monitor, Policy } from "../../types";
import { diffPolicyLines } from "../adapters/policy";
import { setMonitorPolicy } from "../adapters/monitors";
import { useShell } from "../context";
import { useToast } from "../Toasts";
import { truncate } from "../lib/format";

function toPolicy(value: unknown): Policy | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { maxAutoActionsPerRun?: unknown };
  if (typeof candidate.maxAutoActionsPerRun !== "number") return null;
  return value as Policy;
}

interface Parsed {
  readonly policy: Policy | null;
  readonly error: string | null;
}

function parseDraft(text: string): Parsed {
  try {
    const policy = toPolicy(JSON.parse(text));
    return policy
      ? { policy, error: null }
      : { policy: null, error: "A policy needs a numeric maxAutoActionsPerRun." };
  } catch {
    return { policy: null, error: "That is not valid JSON yet." };
  }
}

export function PolicyEditor({ monitor }: { readonly monitor: Monitor }): JSX.Element {
  const { store } = useShell();
  const push = useToast();
  const [text, setText] = useState(() => JSON.stringify(monitor.policy, null, 2));
  const parsed = useMemo(() => parseDraft(text), [text]);
  const lines = useMemo(
    () => (parsed.policy ? diffPolicyLines(monitor.policy, parsed.policy) : []),
    [monitor.policy, parsed.policy],
  );

  const onApply = useCallback(async () => {
    if (!parsed.policy) return;
    const message = await setMonitorPolicy(store, monitor.id, parsed.policy);
    push(truncate(message, 140), "ok");
  }, [store, monitor.id, parsed.policy, push]);

  return (
    <div className="mfw-policy-editor">
      <label className="mfw-label" htmlFor={`policy-${monitor.id}`}>
        Policy JSON
      </label>
      <textarea
        id={`policy-${monitor.id}`}
        className="mfw-textarea"
        spellCheck={false}
        rows={12}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="mfw-diff">
        <h5 className="mfw-diff-title">Diff preview</h5>
        {parsed.error ? <p className="mfw-danger">{parsed.error}</p> : null}
        {!parsed.error && lines.length === 0 ? (
          <p className="mfw-muted">No changes yet.</p>
        ) : null}
        <ul className="mfw-diff-list">
          {lines.map((line) => (
            <li className={`mfw-diff-line mfw-diff-${line.tone}`} key={`${line.tone}-${line.text}`}>
              {line.text}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="mfw-btn mfw-btn-primary" onClick={onApply}>
        Save policy
      </button>
    </div>
  );
}
