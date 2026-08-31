/**
 * The dialog a new workspace opens with: what is already running on this machine.
 *
 * Nawaf, 31 Aug: "when a user creates a new workspace, or is visiting for the first time,
 * show a pop up window that allows the user to attach any actively running ChatGPT
 * desktop or Codex terminal, cmd, powershell, same for Claude Code."
 *
 * A board that opens blank asks the person to describe their own work to it, which they
 * will not do. Their work is already running: four Claude Code sessions, ChatGPT desktop,
 * a couple of shells. So the first thing the board does is ask the machine, and the person
 * only has to tick which of it this board is about.
 *
 * Two lines are held to here:
 *
 *   1. **It asks once per workspace and then never again.** A dialog that reappears is a
 *      dialog people learn to dismiss without reading. Skipping is remembered per board,
 *      in this browser, and the Sessions panel can reopen it deliberately.
 *   2. **It never ticks anything for you.** The list is read off a process table and
 *      carries command lines; which of those belong on a shared board is not a guess
 *      software gets to make.
 */

import { useCallback, useEffect, useState, type JSX } from "react";
import { useBridge } from "../../packs/useBridge";
import { useShell, useWorkspace } from "../../shell/context";
import { withAudit } from "../../shell/adapters/store";
import { DEFAULT_NAME, displayName } from "../../feedback";
import { LIMITS, type AttachedSession, type SessionKind, type Workspace } from "../../types";
import { attach, listSessions } from "../state";
import "./sessions.css";

/** What list_sessions on the bridge hands back. Every field is checked before it is used. */
interface FoundSession {
  readonly id: string;
  readonly kind: SessionKind;
  readonly what: string;
  readonly where?: string;
  readonly minutes?: number;
}

const KINDS: readonly SessionKind[] = ["chatgpt-desktop", "codex", "claude-code", "terminal"];

const KIND_LABEL: Readonly<Record<SessionKind, string>> = {
  "chatgpt-desktop": "ChatGPT desktop",
  codex: "Codex",
  "claude-code": "Claude Code",
  terminal: "Terminal",
};

export const skipKey = (workspaceId: string): string => `mfw:attach-asked:${workspaceId}`;

/** Storage throws in private mode, and a dialog is not worth failing a render over. */
function asked(workspaceId: string): boolean {
  try {
    return globalThis.localStorage?.getItem(skipKey(workspaceId)) === "1";
  } catch {
    return true;
  }
}

function remember(workspaceId: string): void {
  try {
    globalThis.localStorage?.setItem(skipKey(workspaceId), "1");
  } catch {
    /* it will ask again next time, which is the harmless direction to fail in */
  }
}

/** Read the bridge's answer defensively: it is JSON written by another program. */
export function readFound(result: string): readonly FoundSession[] {
  let payload: unknown;
  try {
    payload = JSON.parse(result);
  } catch {
    return [];
  }
  const rows = (payload as { sessions?: unknown }).sessions;
  if (!Array.isArray(rows)) return [];
  const out: FoundSession[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const rec = row as Record<string, unknown>;
    const kind = KINDS.find((known) => known === rec.kind);
    const id = typeof rec.id === "string" ? rec.id : "";
    const what = typeof rec.what === "string" ? rec.what : "";
    if (kind === undefined || id.length === 0 || what.length === 0) continue;
    out.push({
      id,
      kind,
      what: what.slice(0, LIMITS.maxSessionWhatChars),
      ...(typeof rec.where === "string" && rec.where.length > 0 ? { where: rec.where.slice(0, 90) } : {}),
      ...(typeof rec.minutes === "number" && Number.isFinite(rec.minutes) ? { minutes: rec.minutes } : {}),
    });
  }
  return out.slice(0, LIMITS.maxSessions);
}

export function howLong(minutes: number | undefined): string {
  if (minutes === undefined) return "";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

type Phase = "closed" | "asking" | "attached";

export function AttachSessions(): JSX.Element | null {
  const workspace = useWorkspace();
  const { store } = useShell();
  const bridge = useBridge();
  const [phase, setPhase] = useState<Phase>("closed");
  const [found, setFound] = useState<readonly FoundSession[] | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [problem, setProblem] = useState("");

  const already = listSessions(workspace).length > 0;

  // Open once, for a board that has never been asked and has nothing attached yet.
  useEffect(() => {
    if (phase !== "closed") return;
    if (already || asked(workspace.id)) return;
    setPhase("asking");
  }, [already, phase, workspace.id]);

  // Pulled out of the object useBridge returns, deliberately.
  //
  // useBridge spreads its state into a new object on every render, so `bridge` itself is a
  // different value each time. Depending on it made `look` unstable, which made the effect
  // below re-run on every render, which called setFound(null) again, which re-rendered:
  // the dialog sat on "Asking your machine..." for ever while the bridge answered in a
  // second. These two are useCallback'd inside the hook and do not change.
  const { call: askMachine, status: bridgeStatus } = bridge;

  const look = useCallback(async () => {
    setProblem("");
    setFound(null);
    const outcome = await askMachine("list_sessions");
    if (!outcome.ok) {
      setProblem(outcome.result);
      setFound([]);
      return;
    }
    setFound(readFound(outcome.result));
  }, [askMachine]);

  // Ask the machine as soon as the bridge is on, and again if it connects while open.
  useEffect(() => {
    if (phase !== "asking" || bridgeStatus !== "on") return;
    void look();
  }, [bridgeStatus, look, phase]);

  const close = useCallback(() => {
    remember(workspace.id);
    setPhase("closed");
  }, [workspace.id]);

  const toggle = useCallback((id: string) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const confirm = useCallback(async () => {
    const chosen = (found ?? []).filter((session) => picked.has(session.id));
    if (chosen.length === 0) {
      close();
      return;
    }
    const at = new Date().toISOString();
    // Whose machine this is. Somebody who has not typed a name yet is not "Unnamed" here:
    // the host reads back inside a sentence ("the loop X on ..."), and "this machine" is
    // both true and readable where a placeholder name is neither.
    const typed = displayName();
    const host = typed === DEFAULT_NAME ? "this machine" : typed;
    const rows: readonly AttachedSession[] = chosen.map((session) => ({
      id: session.id,
      kind: session.kind,
      what: session.what,
      ...(session.where === undefined ? {} : { where: session.where }),
      host,
      attachedAt: at,
      placement: "unplaced",
    }));
    await store.update((ws: Workspace) =>
      withAudit(attach(ws, rows), {
        actor: "human",
        tool: "attach_sessions",
        args: { sessions: rows.map((row) => row.id) },
        result: `${host} attached ${rows.length} running session${rows.length === 1 ? "" : "s"}. Each one still needs a verdict.`,
      }),
    );
    remember(workspace.id);
    setPhase("attached");
  }, [close, found, picked, store, workspace.id]);

  if (phase === "closed") return null;

  return (
    <div className="mfw-attach__scrim" role="presentation">
      <div className="mfw-attach" role="dialog" aria-modal="true" aria-labelledby="mfw-attach-title">
        {phase === "attached" ? (
          <Done count={picked.size} onClose={() => setPhase("closed")} />
        ) : (
          <>
            <h2 id="mfw-attach-title">What is already running?</h2>
            <p className="mfw-attach__lead">
              This board can start from the work you have going rather than from nothing. Tick the
              sessions it is about. Nothing here can start or stop any of them.
            </p>

            {bridgeStatus === "on" ? (
              <Listing
                found={found}
                onRefresh={() => void look()}
                onToggle={toggle}
                picked={picked}
                problem={problem}
              />
            ) : (
              <NoBridge onConnect={bridge.connect} status={bridgeStatus} error={bridge.error} />
            )}

            <div className="mfw-attach__row">
              <button className="mfw-btn" onClick={close} type="button">
                Not now
              </button>
              <button
                className="mfw-btn mfw-btn--go"
                disabled={picked.size === 0}
                onClick={() => void confirm()}
                type="button"
              >
                {picked.size === 0 ? "Attach" : `Attach ${picked.size}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NoBridge(props: {
  readonly onConnect: () => void;
  readonly status: string;
  readonly error: string;
}): JSX.Element {
  return (
    <div className="mfw-attach__empty">
      <p>
        Your machine is not attached to this page yet. The bridge is a small program you run
        yourself; the page never reaches your machine without it.
      </p>
      <pre className="mfw-attach__cmd">npx mcpforwork-bridge --owner "your name" --pack sessions</pre>
      {props.error === "" ? null : <p className="mfw-attach__warn">{props.error}</p>}
      <button className="mfw-btn" onClick={props.onConnect} type="button">
        {props.status === "connecting" ? "Connecting..." : "Connect the bridge"}
      </button>
    </div>
  );
}

function Listing(props: {
  readonly found: readonly FoundSession[] | null;
  readonly picked: ReadonlySet<string>;
  readonly problem: string;
  readonly onToggle: (id: string) => void;
  readonly onRefresh: () => void;
}): JSX.Element {
  if (props.found === null) {
    return <p className="mfw-attach__empty">Asking your machine what is running...</p>;
  }
  if (props.found.length === 0) {
    return (
      <div className="mfw-attach__empty">
        <p>
          {props.problem === ""
            ? "Nothing is running that this can attach: no ChatGPT desktop, no Codex, no Claude Code, no shell in use."
            : props.problem}
        </p>
        <button className="mfw-btn" onClick={props.onRefresh} type="button">
          Look again
        </button>
      </div>
    );
  }
  return (
    <>
      <ul className="mfw-attach__list">
        {props.found.map((session) => (
          <li key={session.id}>
            <label className="mfw-attach__row-item">
              <input
                checked={props.picked.has(session.id)}
                onChange={() => props.onToggle(session.id)}
                type="checkbox"
              />
              <span className="mfw-attach__name">
                {KIND_LABEL[session.kind]}
                {session.where === undefined ? null : (
                  <span className="mfw-attach__where">{session.where}</span>
                )}
                {session.minutes === undefined ? null : (
                  <span className="mfw-attach__age">{howLong(session.minutes)}</span>
                )}
              </span>
              <span className="mfw-attach__what">{session.what}</span>
            </label>
          </li>
        ))}
      </ul>
      <button className="mfw-attach__again" onClick={props.onRefresh} type="button">
        Look again
      </button>
    </>
  );
}

function Done(props: { readonly count: number; readonly onClose: () => void }): JSX.Element {
  return (
    <>
      <h2 id="mfw-attach-title">Attached</h2>
      <p className="mfw-attach__lead">
        {props.count} session{props.count === 1 ? "" : "s"} are on this board, and none of them is
        placed yet. Ask your agent to go through them: for each one it has to say whether it is a
        loop worth putting in a layer or a one-off, and why.
      </p>
      <pre className="mfw-attach__cmd">
        On mcpforwork.com, call list_attached and then place_session on each one.
      </pre>
      <div className="mfw-attach__row">
        <button className="mfw-btn mfw-btn--go" onClick={props.onClose} type="button">
          Done
        </button>
      </div>
    </>
  );
}
