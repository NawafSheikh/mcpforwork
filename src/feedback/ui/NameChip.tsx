/**
 * NameChip: the visitor says who they are, in one click.
 *
 * The name signs the notes this browser leaves, so an agent can answer "Maria" instead of
 * "human", and the orchestrator feeds the same value into the room presence label. It is
 * a courtesy, not a login: it never leaves localStorage except on a note the visitor wrote.
 */
import { useCallback, useState, useSyncExternalStore, type FormEvent } from "react";

import { MAX_NAME_CHARS, displayName, setDisplayName, subscribeName } from "../identity";
import "./feedback.css";

const LABEL = "Your name on this board";

/** Re-renders every chip on the page when any one of them saves a new name. */
export function useDisplayName(): string {
  const subscribe = useCallback((onChange: () => void) => subscribeName(onChange), []);
  return useSyncExternalStore(subscribe, displayName, displayName);
}

export interface NameChipProps {
  /** Called with the saved name, so the shell can push it into the room presence label. */
  readonly onRename?: (name: string) => void;
}

export function NameChip({ onRename }: NameChipProps): JSX.Element {
  const name = useDisplayName();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const start = (): void => {
    setDraft(name);
    setEditing(true);
  };

  const commit = (): void => {
    const saved = setDisplayName(draft);
    setEditing(false);
    onRename?.(saved);
  };

  const save = (event: FormEvent): void => {
    event.preventDefault();
    commit();
  };

  if (!editing) {
    return (
      <button type="button" className="mfw-fb-name" title={LABEL} aria-label={LABEL} onClick={start}>
        {name}
      </button>
    );
  }

  return (
    <form className="mfw-fb-name-form" onSubmit={save}>
      <input
        className="mfw-fb-name-input"
        type="text"
        value={draft}
        maxLength={MAX_NAME_CHARS}
        aria-label={LABEL}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
      />
      <button type="submit" className="mfw-fb-send">
        Save
      </button>
    </form>
  );
}
