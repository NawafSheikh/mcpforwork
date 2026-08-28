/**
 * FeedbackBox: the human half of the turn taking.
 *
 * Mounted next to whatever it is about (a dashboard, the overview, a draft, a monitor).
 * A note left here is what the agent reads through list_feedback and closes through
 * resolve_feedback, so this small box is the whole handover between the two sides.
 */
import { useMemo, useState, type FormEvent } from "react";
import type { Actor, Feedback, FeedbackTarget } from "../../types";
import { useShell, useWorkspace } from "../../shell/context";
import { addFeedback, openFeedback, resolveFeedback, resolvedFeedback } from "../store";
import "./feedback.css";

const AUTHOR_LABELS: Readonly<Record<Actor, string>> = {
  agent: "ChatGPT",
  human: "You",
  system: "System",
};

const RESOLVED_BY_HUMAN = "Marked done on the page";

/** Coarse on purpose: a note is either fresh, from today, or old news. */
function age(iso: string, from: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((from - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function NoteHead({ item }: { readonly item: Feedback }): JSX.Element {
  return (
    <span className="mfw-fb-head">
      <span className={`mfw-fb-author mfw-fb-author-${item.author}`}>
        {AUTHOR_LABELS[item.author]}
      </span>
      <span className="mfw-fb-age">{age(item.createdAt)}</span>
    </span>
  );
}

function OpenNote({
  item,
  onResolve,
}: {
  readonly item: Feedback;
  readonly onResolve: (id: string) => void;
}): JSX.Element {
  return (
    <li className="mfw-fb-note">
      <NoteHead item={item} />
      <p className="mfw-fb-text">{item.text}</p>
      <button type="button" className="mfw-fb-resolve" onClick={() => onResolve(item.id)}>
        Resolve
      </button>
    </li>
  );
}

function ResolvedNote({ item }: { readonly item: Feedback }): JSX.Element {
  return (
    <li className="mfw-fb-note mfw-fb-note-done">
      <NoteHead item={item} />
      <p className="mfw-fb-text">{item.text}</p>
      {item.resolution ? <p className="mfw-fb-resolution">{item.resolution}</p> : null}
    </li>
  );
}

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
    void store.update((ws) => addFeedback(ws, { target, text, author: "human" }));
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
      {open.length > 0 ? (
        <ol className="mfw-fb-list">
          {open.map((item) => (
            <OpenNote key={item.id} item={item} onResolve={resolve} />
          ))}
        </ol>
      ) : null}
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
          {showDone ? (
            <ol className="mfw-fb-list">
              {done.map((item) => (
                <ResolvedNote key={item.id} item={item} />
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
