/**
 * The composer with a target picker: who is this for?
 *
 * Four directions on one thread (docs/UI.md): everyone in the room, one person by name,
 * one agent by its caller name, or any agent that picks it up first. The hint says the
 * honest thing about where the work actually happens: in the visitor's own ChatGPT.
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ANY_ONE, ROOM_TARGET, addFeedback, displayName } from "../../feedback";
import { askCapability, type AskRequest } from "../../packs";
import { usePresence } from "../../rooms";
import type { FeedbackTarget } from "../../types";
import { useShell, useWorkspace } from "../context";
import { callerName } from "../lib/format";

const HINT = "Anything asked here runs in your ChatGPT, not here.";
const ROOM_OPTION = "room";
const ANY_AGENT = "agent:*";

interface Option {
  readonly value: string;
  readonly label: string;
  readonly target: FeedbackTarget;
}

/** Everyone the room can name right now: peers by label, agents by caller. */
function useOptions(): readonly Option[] {
  const workspace = useWorkspace();
  const presence = usePresence();
  return useMemo(() => {
    const people = presence.peers
      .filter((peer) => !peer.self)
      .map((peer) => ({
        value: `person:${peer.label}`,
        label: `${peer.label} (person)`,
        target: { kind: "person", id: peer.label } as FeedbackTarget,
      }));
    const agents = [
      ...new Set(
        workspace.audit.filter((event) => event.actor === "agent").map((event) => callerName(event)),
      ),
    ].map((caller) => ({
      value: `agent:${caller}`,
      label: `${caller} (agent)`,
      target: { kind: "agent", id: caller } as FeedbackTarget,
    }));
    return [
      { value: ROOM_OPTION, label: "Everyone in this room", target: ROOM_TARGET },
      { value: ANY_AGENT, label: "Any agent here", target: { kind: "agent", id: ANY_ONE } },
      ...people,
      ...agents,
    ];
  }, [workspace.audit, presence.peers]);
}

/** A card can name somebody the audit rail has never seen, so the pick is added too. */
function askOption(ask: AskRequest): Option {
  return {
    value: `${ask.target.kind}:${ask.target.id}`,
    label: `${ask.target.id} (${ask.target.kind})`,
    target: ask.target as FeedbackTarget,
  };
}

export function RequestComposer(): JSX.Element {
  const { store } = useShell();
  const known = useOptions();
  const [to, setTo] = useState(ROOM_OPTION);
  const [text, setText] = useState("");
  const [extra, setExtra] = useState<Option | null>(null);

  // "Ask this agent" on a capability card lands here, whether the card was clicked
  // before this page was open or while it was.
  useEffect(() => {
    const apply = (ask: AskRequest): void => {
      const option = askOption(ask);
      setExtra(option);
      setTo(option.value);
      setText(ask.text);
      askCapability.clear();
    };
    const pending = askCapability.recent()[0];
    if (pending !== undefined) apply(pending);
    return askCapability.subscribe(apply);
  }, []);

  const options = useMemo(
    () =>
      extra === null || known.some((option) => option.value === extra.value)
        ? known
        : [...known, extra],
    [known, extra],
  );

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const body = text.trim();
    const option = options.find((entry) => entry.value === to) ?? options[0];
    if (body.length === 0 || option === undefined) return;
    setText("");
    void store.update((ws) =>
      addFeedback(ws, { target: option.target, text: body, author: "human", from: displayName() }),
    );
  };

  return (
    <form className="mfw-compose" onSubmit={submit}>
      <label className="mfw-compose__to">
        <span className="mfw-visually-hidden">Who is this request for</span>
        <select value={to} onChange={(event) => setTo(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <input
        className="mfw-fb-input"
        type="text"
        value={text}
        placeholder="Ask for something"
        aria-label="Ask for something"
        onChange={(event) => setText(event.target.value)}
      />
      <button type="submit" className="mfw-fb-send" disabled={text.trim().length === 0}>
        Ask
      </button>
      <p className="mfw-compose__hint">{HINT}</p>
    </form>
  );
}
