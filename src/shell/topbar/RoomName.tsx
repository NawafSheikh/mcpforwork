/**
 * The room's name, editable in place by whoever holds a write link.
 *
 * A read-only link renders the plain name: the role is a promise this page keeps, not a
 * permission the relay enforces (docs/LIMITATIONS.md), and saying so is better than
 * pretending. Outside a room the name is "Local board" and there is nothing to edit.
 */
import { useState } from "react";
import { usePresence } from "../../rooms";
import { useShell, useWorkspace } from "../context";
import { roomTitle } from "../lib/room";

const LABEL = "Rename this room";

export interface RoomNameProps {
  /** False for a read-only link, and for a board that is not in a room. */
  readonly editable: boolean;
}

export function RoomName({ editable }: RoomNameProps): JSX.Element {
  const workspace = useWorkspace();
  const { store } = useShell();
  const presence = usePresence();
  const [draft, setDraft] = useState<string | null>(null);
  const title = roomTitle(workspace, presence.slug);

  const commit = (next: string): void => {
    setDraft(null);
    const name = next.trim();
    if (name.length === 0 || name === title) return;
    void store.update((ws) => ({ ...ws, name }));
  };

  if (draft !== null) {
    return (
      <input
        className="mfw-roomname mfw-roomname--edit"
        value={draft}
        aria-label={LABEL}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(draft);
          if (event.key === "Escape") setDraft(null);
        }}
      />
    );
  }

  if (!editable || presence.slug === null) return <span className="mfw-roomname">{title}</span>;

  return (
    <button type="button" className="mfw-roomname mfw-roomname--btn" title={LABEL} onClick={() => setDraft(title)}>
      {title}
    </button>
  );
}
