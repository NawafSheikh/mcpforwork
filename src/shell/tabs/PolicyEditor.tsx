/**
 * Guardrail editor. A form by default, because a policy is a promise about what runs
 * without asking and nobody should have to write JSON to make one. The JSON textarea
 * is still here for power users, kept in sync both ways and validated with the same
 * schema the set_policy tool uses.
 *
 * Saving goes through setMonitorPolicy, exactly as the old textarea did, so the change
 * is still a set_policy call audited as actor "human".
 */
import { useCallback, useMemo, useState } from "react";
import type { Monitor, Policy } from "../../types";
import { describePolicyText, diffPolicyLines } from "../adapters/policy";
import { setMonitorPolicy } from "../adapters/monitors";
import { useShell } from "../context";
import { useToast } from "../Toasts";
import { truncate } from "../lib/format";
import { FormPanel } from "./policy/FormPanel";
import { JsonPanel } from "./policy/JsonPanel";
import { parsePolicyJson, stringifyPolicy } from "./policy/json";
import { formIssues, policyFromForm, toForm, type PolicyForm } from "./policy/model";
import "./policy/policy.css";

type Mode = "form" | "json";

function Preview({
  saved,
  pending,
}: {
  readonly saved: Policy;
  readonly pending: Policy;
}): JSX.Element {
  const lines = useMemo(() => diffPolicyLines(saved, pending), [saved, pending]);
  return (
    <div className="mfw-diff">
      <h5 className="mfw-diff-title">What this policy says</h5>
      <p className="mfw-pf-sentence">{describePolicyText(pending)}</p>
      <h5 className="mfw-diff-title">Changes against the saved policy</h5>
      {lines.length === 0 ? <p className="mfw-muted">No changes yet.</p> : null}
      <ul className="mfw-diff-list">
        {lines.map((line) => (
          <li className={`mfw-diff-line mfw-diff-${line.tone}`} key={`${line.tone}-${line.text}`}>
            {line.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Blockers({ issues }: { readonly issues: readonly string[] }): JSX.Element | null {
  if (issues.length === 0) return null;
  return (
    <ul className="mfw-pf-errors" role="status">
      {issues.map((issue) => (
        <li className="mfw-danger" key={issue}>
          {issue}
        </li>
      ))}
    </ul>
  );
}

export function PolicyEditor({ monitor }: { readonly monitor: Monitor }): JSX.Element {
  const { store } = useShell();
  const push = useToast();
  const [mode, setMode] = useState<Mode>("form");
  const [form, setForm] = useState<PolicyForm>(() => toForm(monitor.policy));
  const [jsonText, setJsonText] = useState("");
  const [jsonErrors, setJsonErrors] = useState<readonly string[]>([]);

  const pending = useMemo(() => policyFromForm(form), [form]);
  const issues = mode === "form" ? formIssues(form) : jsonErrors;

  const onJsonChange = useCallback((text: string) => {
    setJsonText(text);
    const parsed = parsePolicyJson(text);
    setJsonErrors(parsed.errors);
    if (parsed.policy) setForm(toForm(parsed.policy));
  }, []);

  const onToggleMode = useCallback(() => {
    if (mode === "json") {
      setMode("form");
      return;
    }
    setJsonText(stringifyPolicy(policyFromForm(form)));
    setJsonErrors([]);
    setMode("json");
  }, [mode, form]);

  const onApply = useCallback(async () => {
    if (issues.length > 0) return;
    const message = await setMonitorPolicy(store, monitor.id, pending);
    push(truncate(message, 140), "ok");
  }, [store, monitor.id, pending, issues.length, push]);

  const idBase = `policy-${monitor.id}`;
  return (
    <div className="mfw-policy-editor">
      <div className="mfw-pf-head">
        <h4 className="mfw-pf-title">Guardrails for {monitor.name}</h4>
        <button type="button" className="mfw-btn mfw-btn-ghost" onClick={onToggleMode}>
          {mode === "form" ? "Edit as JSON" : "Back to the form"}
        </button>
      </div>
      {mode === "form" ? (
        <FormPanel idBase={idBase} form={form} onChange={setForm} />
      ) : (
        <JsonPanel
          id={`${idBase}-json`}
          text={jsonText}
          errors={jsonErrors}
          onChange={onJsonChange}
        />
      )}
      <Preview saved={monitor.policy} pending={pending} />
      <Blockers issues={issues} />
      <button
        type="button"
        className="mfw-btn mfw-btn-primary"
        disabled={issues.length > 0}
        onClick={onApply}
      >
        Save policy
      </button>
    </div>
  );
}
