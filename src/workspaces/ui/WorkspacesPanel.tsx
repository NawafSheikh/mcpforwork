/**
 * The Workspaces panel: every board this browser holds, and one line saying whether it
 * is on disk.
 *
 * No ceremony. Clicking a row opens that board. New takes a name and opens an empty one.
 * Rename is the name field on the open row. Copy makes a version to fall back to. Delete
 * is the only thing that asks twice, because it is the only thing that loses work.
 */
import { useCallback, useState } from "react";
import { useWorkspaces } from "../useWorkspaces";
import type { WorkspaceEntry } from "../types";
import { entryLine } from "../runtime";
import { savedLabel } from "./savedLabel";
import "./workspaces.css";

function Row({
  entry,
  open,
  onOpen,
  onCopy,
  onDelete,
  deletable,
  copyable,
}: {
  readonly entry: WorkspaceEntry;
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onCopy: () => void;
  readonly onDelete: () => void;
  readonly deletable: boolean;
  readonly copyable: boolean;
}): JSX.Element {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className={`mfw-ws ${open ? "mfw-ws--open" : ""}`.trim()}>
      <button
        type="button"
        className="mfw-ws__open"
        aria-current={open ? "true" : undefined}
        onClick={onOpen}
        disabled={open && copyable}
      >
        <span className="mfw-ws__name">{entry.name}</span>
        <span className="mfw-ws__line">{open ? `${entryLine(entry)} · open` : entryLine(entry)}</span>
      </button>
      <span className="mfw-ws__acts">
        {!copyable ? null : (
          <button type="button" className="mfw-btn mfw-btn-ghost" onClick={onCopy}>
            Copy
          </button>
        )}
        {!deletable ? null : confirming ? (
          <>
            <button
              type="button"
              className="mfw-btn mfw-btn-danger"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              Delete for good
            </button>
            <button type="button" className="mfw-btn mfw-btn-ghost" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </>
        ) : (
          <button type="button" className="mfw-btn mfw-btn-ghost" onClick={() => setConfirming(true)}>
            Delete
          </button>
        )}
      </span>
    </li>
  );
}

function NewRow({ onCreate }: { readonly onCreate: (name: string) => void }): JSX.Element {
  const [name, setName] = useState("");
  const submit = useCallback(() => {
    const wanted = name.trim();
    if (wanted.length === 0) return;
    setName("");
    onCreate(wanted);
  }, [name, onCreate]);

  return (
    <form
      className="mfw-ws-new"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        className="mfw-input"
        value={name}
        maxLength={60}
        placeholder="New workspace, for example Invoices"
        aria-label="New workspace name"
        onChange={(event) => setName(event.target.value)}
      />
      <button type="submit" className="mfw-btn mfw-btn-primary" disabled={name.trim().length === 0}>
        Create and open
      </button>
    </form>
  );
}

export function WorkspacesPanel(): JSX.Element {
  const api = useWorkspaces();
  const [note, setNote] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string>(api.current.name);
  const [editing, setEditing] = useState(false);

  const run = useCallback(async (work: Promise<{ message: string }>) => {
    setNote((await work).message);
  }, []);

  if (!api.available) {
    return (
      <p className="mfw-pop__note">
        This board came from a link, so it is not one of the workspaces saved in this browser.
        Open mcpforwork.com without the link to get back to yours.
      </p>
    );
  }

  const room = api.heldByRoom;
  return (
    <div className="mfw-wss">
      <header className="mfw-wss__head">
        <span className="mfw-wss__state" role="status">
          {room === null ? savedLabel(api.saveState, api.current.savedAt) : "In a room"}
        </span>
        <button
          type="button"
          className="mfw-btn"
          disabled={room !== null}
          onClick={() => void run(api.save())}
        >
          Save now
        </button>
      </header>
      {room === null ? null : <p className="mfw-pop__note">{room}</p>}

      <div className="mfw-ws-rename" hidden={room !== null}>
        {editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setEditing(false);
              void run(api.rename(renaming));
            }}
          >
            <input
              className="mfw-input"
              value={renaming}
              maxLength={60}
              aria-label="Workspace name"
              autoFocus
              onChange={(event) => setRenaming(event.target.value)}
            />
            <button type="submit" className="mfw-btn">
              Rename
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="mfw-btn mfw-btn-ghost"
            onClick={() => {
              setRenaming(api.current.name);
              setEditing(true);
            }}
          >
            {`Rename "${api.current.name}"`}
          </button>
        )}
      </div>

      <ul className="mfw-ws-list">
        {api.entries.map((entry) => (
          <Row
            key={entry.id}
            entry={entry}
            open={entry.id === api.current.id}
            deletable={room === null && api.entries.length > 1}
            onOpen={() => void run(api.switchTo(entry.id))}
            onCopy={() => void run(api.duplicate(entry.id))}
            copyable={room === null}
            onDelete={() => void run(api.remove(entry.id))}
          />
        ))}
      </ul>

      {room === null ? <NewRow onCreate={(name) => void run(api.create(name))} /> : null}

      {note === null ? null : (
        <p className="mfw-pop__note" role="status">
          {note}
        </p>
      )}
      <p className="mfw-pop__note">
        Each workspace is its own board: its own categories, monitors, policies and notes. Your
        agent can make and switch them too, with create_workspace and switch_workspace.
      </p>
    </div>
  );
}
