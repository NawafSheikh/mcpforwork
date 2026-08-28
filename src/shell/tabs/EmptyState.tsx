/** Board empty state: the prompt to paste and what happens next. */
import { useCallback } from "react";
import { copyText } from "../lib/clipboard";
import { BOARD_STEPS, STARTER_PROMPT } from "../lib/constants";
import { useToast } from "../Toasts";

export function EmptyState(): JSX.Element {
  const push = useToast();

  const onCopy = useCallback(async () => {
    const ok = await copyText(STARTER_PROMPT);
    push(ok ? "Starter prompt copied." : "Copy blocked. Select the prompt above.", ok ? "ok" : "warn");
  }, [push]);

  return (
    <section className="mfw-empty">
      <h1 className="mfw-empty-title">Your work, agent ready</h1>
      <p className="mfw-empty-lead">
        This page is the board and the guardrails. Your own ChatGPT is the analyst: it reads your
        mail, files and tickets through its own connectors, then builds every dashboard here.
      </p>
      <div className="mfw-prompt-box">
        <p className="mfw-prompt-text">{STARTER_PROMPT}</p>
        <button type="button" className="mfw-btn mfw-btn-primary" onClick={onCopy}>
          Copy starter prompt
        </button>
      </div>
      <ol className="mfw-steps">
        {BOARD_STEPS.map((step) => (
          <li className="mfw-step" key={step.title}>
            <h2 className="mfw-step-title">{step.title}</h2>
            <p className="mfw-step-body">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
