/**
 * FeedbackBox: the human half of the turn taking.
 *
 * Mounted next to whatever it is about (a dashboard, the overview, a draft, a monitor).
 * A note left here is what the agent reads through list_feedback and closes through
 * resolve_feedback, so this small box is the whole handover between the two sides.
 * A note signs itself with this browser's display name, so the agent can answer a person
 * by name instead of answering "human".
 */
import { useMemo, useState, type FormEvent } from "react";
import type { FeedbackTarget } from "../../types";
import { useShell, useWorkspace } from "../../shell/context";
import { displayName } from "../identity";
import { addFeedback, openFeedback, resolveFeedback, resolvedFeedback } from "../store";
import { NoteList } from "./notes";
import "./feedback.css";

const RESOLVED_BY_HUMAN = "Marked done on the page";

export interface FeedbackBoxProps {
  readonly target: FeedbackTarget;
  /** Drops the heading and the intro line where space is tight. */
  readonly compact?: boolean;
}

export function FeedbackBox({ target, compact }: FeedbackBoxProps): JSX.Element {
  const { store } = useShell();
  const workspace = useWorkspace();
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(false);

  const open = useMemo(() => openFeedback(workspace, target), [workspace, target]);
  const done = useMemo(() => resolvedFeedback(workspace, target), [workspace, target]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const text = draft.trim();
    if (text.length === 0) return;
    setDraft("");
    void store.update((ws) =>
      addFeedback(ws, { target, text, author: "human", from: displayName() }),
    );
  };

  const resolve = (id: string): void => {
    void store.update(
      (ws) => resolveFeedback(ws, id, { by: "human", resolution: RESOLVED_BY_HUMAN }) ?? ws,
    );
  };

  return (
    <section className={compact ? "mfw-fb mfw-fb-compact" : "mfw-fb"} aria-label="Feedback">
      {compact ? null : (
        <header className="mfw-fb-top">
          <h4 className="mfw-fb-title">Notes for the agent</h4>
          <span className="mfw-fb-count">{open.length === 0 ? "none open" : `${open.length} open`}</span>
        </header>
      )}
      <NoteList items={open} onResolve={resolve} />
      <form className="mfw-fb-form" onSubmit={submit}>
        <input
          className="mfw-fb-input"
          type="text"
          value={draft}
          placeholder="Leave a note for the agent"
          aria-label="Leave a note for the agent"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="mfw-fb-send" disabled={draft.trim().length === 0}>
          Leave note
        </button>
      </form>
      {done.length > 0 ? (
        <div className="mfw-fb-done">
          <button
            type="button"
            className="mfw-fb-toggle"
            aria-expanded={showDone}
            onClick={() => setShowDone((value) => !value)}
          >
            {`Resolved (${done.length})`}
          </button>
          {showDone ? <NoteList items={done} /> : null}
        </div>
      ) : null}
    </section>
  );
}
