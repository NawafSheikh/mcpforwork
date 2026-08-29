/**
 * RoomRequests: the one thread that carries the whole room, in all four directions.
 *
 * A person asks the agents here, an agent hands work to another person's agent by caller
 * name, an agent asks a person by name, a person asks another person. They all land in
 * the same list because they are all feedback with an addressed target (agent, person or
 * room), and both humans watch them arrive through the rooms sync.
 *
 * The orchestrator mounts this once, next to presence. See src/feedback/INTEGRATION.md.
 */
import { useMemo, useState, type FormEvent } from "react";
import type { Feedback } from "../../types";
import { useShell, useWorkspace } from "../../shell/context";
import { displayName } from "../identity";
import { addressedFeedback, isOpen, resolveFeedback, ROOM_TARGET, addFeedback } from "../store";
import { NoteList } from "./notes";
import "./feedback.css";

const RESOLVED_BY_HUMAN = "Marked done on the page";
const ASK = "Ask the agents in this room";

const countLine = (open: number): string =>
  open === 0 ? "nothing open" : `${open} open`;

function useThread(): { readonly open: readonly Feedback[]; readonly done: readonly Feedback[] } {
  const workspace = useWorkspace();
  return useMemo(() => {
    const all = addressedFeedback(workspace, true);
    return { open: all.filter(isOpen), done: all.filter((item) => !isOpen(item)) };
  }, [workspace]);
}

export function RoomRequests(): JSX.Element {
  const { store } = useShell();
  const { open, done } = useThread();
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(false);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const text = draft.trim();
    if (text.length === 0) return;
    setDraft("");
    void store.update((ws) =>
      addFeedback(ws, { target: ROOM_TARGET, text, author: "human", from: displayName() }),
    );
  };

  const resolve = (id: string): void => {
    void store.update(
      (ws) => resolveFeedback(ws, id, { by: "human", resolution: RESOLVED_BY_HUMAN }) ?? ws,
    );
  };

  return (
    <section className="mfw-fb mfw-fb-room" aria-label="Room requests">
      <header className="mfw-fb-top">
        <h4 className="mfw-fb-title">Room requests</h4>
        <span className="mfw-fb-count">{countLine(open.length)}</span>
      </header>
      <p className="mfw-fb-hint">
        Anything asked here reaches every person and every agent on this board.
      </p>
      <NoteList items={open} onResolve={resolve} />
      <form className="mfw-fb-form" onSubmit={submit}>
        <input
          className="mfw-fb-input"
          type="text"
          value={draft}
          placeholder={ASK}
          aria-label={ASK}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="mfw-fb-send" disabled={draft.trim().length === 0}>
          Ask
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
            {`Done (${done.length})`}
          </button>
          {showDone ? <NoteList items={done} /> : null}
        </div>
      ) : null}
    </section>
  );
}
