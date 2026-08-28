/**
 * Backup popover: download this board as a file, or put one back.
 *
 * The board already lives in IndexedDB in this browser, which is one clear of a cache,
 * one private window or one other machine away from being gone. A file is the copy you
 * can actually keep, so this sits in the header next to the prompts.
 */
import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import { useShell, useWorkspace } from "../../shell/context";
import { withAudit } from "../../shell/adapters/store";
import type { Workspace } from "../../types";
import {
  BACKUP_TOOL,
  backupFileName,
  backupJson,
  categoryCount,
  downloadJson,
  restoreFrom,
} from "./backupFile";
import "./prompts.css";

interface Note {
  readonly ok: boolean;
  readonly text: string;
}

const READ_FAILED = "That file is not a board this page can read.";

function auditedRestore(candidate: Workspace): Workspace {
  const count = categoryCount(candidate);
  return withAudit(candidate, {
    actor: "human",
    tool: BACKUP_TOOL,
    args: { categories: count, monitors: Object.keys(candidate.monitors).length },
    result: `Board restored from a file: ${count} category(ies), ${candidate.runs.length} run(s).`,
  });
}

function ConfirmRow({
  count,
  onReplace,
  onCancel,
}: {
  readonly count: number;
  readonly onReplace: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <div className="mfw-pl-confirm">
      <p className="mfw-pl-hint">
        {`This replaces the board you have open, including ${count} category(ies). The audit trail is not restored.`}
      </p>
      <div className="mfw-pl-actions">
        <button type="button" className="mfw-btn mfw-btn-primary" onClick={onReplace}>
          Replace the board
        </button>
        <button type="button" className="mfw-btn mfw-btn-ghost" onClick={onCancel}>
          Keep what I have
        </button>
      </div>
    </div>
  );
}

function BackupBody(): JSX.Element {
  const { store } = useShell();
  const workspace = useWorkspace();
  const [note, setNote] = useState<Note | null>(null);
  const [pending, setPending] = useState<Workspace | null>(null);

  const onDownload = useCallback(() => {
    const name = backupFileName();
    downloadJson(backupJson(workspace), name);
    setNote({ ok: true, text: `Saved ${name}` });
  }, [workspace]);

  const apply = useCallback(
    async (candidate: Workspace) => {
      await store.reset(auditedRestore(candidate));
      setPending(null);
      setNote({ ok: true, text: `Board restored: ${categoryCount(candidate)} category(ies).` });
    },
    [store],
  );

  const onFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const candidate = restoreFrom(await file.text(), store.get());
      if (candidate === null) {
        setNote({ ok: false, text: READ_FAILED });
        return;
      }
      setNote(null);
      if (categoryCount(store.get()) > 0) {
        setPending(candidate);
        return;
      }
      await apply(candidate);
    },
    [store, apply],
  );

  return (
    <div className="mfw-pl">
      <h4>Backup</h4>
      <p className="mfw-pl-hint">
        This board is saved in this browser. A file is the copy you can move, keep or send.
      </p>
      <div className="mfw-pl-actions">
        <button type="button" className="mfw-btn" onClick={onDownload}>
          Download board
        </button>
      </div>
      <label className="mfw-pl-file" htmlFor="mfw-restore-file">
        <span>Restore from file</span>
        <input
          id="mfw-restore-file"
          type="file"
          accept=".json,application/json"
          onChange={(event) => void onFile(event)}
        />
      </label>
      {pending !== null ? (
        <ConfirmRow
          count={categoryCount(workspace)}
          onReplace={() => void apply(pending)}
          onCancel={() => {
            setPending(null);
            setNote({ ok: true, text: "Kept the board you had." });
          }}
        />
      ) : null}
      {note !== null ? (
        <p className={note.ok ? "mfw-pl-hint" : "mfw-pl-warn"} role="status">
          {note.text}
        </p>
      ) : null}
      <p className="mfw-share-pop-note">
        The file holds the board and its notes. The audit trail stays on this machine.
      </p>
    </div>
  );
}

export interface BackupProps {
  /** Renders the popover already open. Used by the tests and by nothing else. */
  readonly defaultOpen?: boolean;
}

export function Backup({ defaultOpen = false }: BackupProps = {}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <span
      className="mfw-share-wrap"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="mfw-btn"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Backup
      </button>
      {open ? (
        <div className="mfw-share-pop mfw-pl-pop">
          <BackupBody />
        </div>
      ) : null}
    </span>
  );
}
