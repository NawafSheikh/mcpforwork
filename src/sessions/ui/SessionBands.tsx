/**
 * The three bands the loops picture gets once sessions are real.
 *
 * Nawaf, 31 Aug: "the active session is always the top most layer, where all terminals or
 * sessions and the outcomes are known when they come, and the loop works accordingly...
 * now if the user says build me a PowerPoint presentation, that doesn't go in any loops;
 * ChatGPT does it outside the loop."
 *
 *   LiveBand      the session you are in, above every layer. It is not a loop and cannot
 *                 be moved, because it is the thing all the loops report into.
 *   WaitingBand   sessions attached and not yet ruled on. It empties as the agent works,
 *                 which is what makes "go through them" a visible job rather than a hope.
 *   OutsideBand   work done deliberately outside the loops, kept on screen so that "looked
 *                 at and ruled out" does not render identically to "never looked at".
 */

import type { JSX } from "react";
import { useWorkspace } from "../../shell/context";
import { heldName } from "../../agents/identity";
import type { AttachedSession, SessionKind } from "../../types";
import { listOutside, listSessions, placedAs, unplaced } from "../state";
import "./sessions.css";

const KIND_LABEL: Readonly<Record<SessionKind, string>> = {
  "chatgpt-desktop": "ChatGPT desktop",
  codex: "Codex",
  "claude-code": "Claude Code",
  terminal: "Terminal",
};

export function sessionTitle(session: AttachedSession): string {
  const kind = KIND_LABEL[session.kind];
  return session.where === undefined ? kind : `${kind} in ${session.where}`;
}

/**
 * The session the person is in right now.
 *
 * There is nothing to attach or place here: the agent calling this page's tools is by
 * construction the top of the picture, and the loops below report up into the conversation
 * it is having. Attaching it would put the room inside the room.
 */
export function LiveBand(): JSX.Element {
  const name = heldName();
  return (
    <div className="mfw-loop-layer mfw-loop-layer--live">
      <span className="mfw-loop-layer__tag">this session, the top</span>
      <div className="mfw-loop-layer__row">
        <div className="mfw-loop mfw-loop--live">
          <span className="mfw-loop__top">
            <span className="mfw-loop__name">{name ?? "Your agent"}</span>
            <span className="mfw-loop__state mfw-loop__state--running">here</span>
          </span>
          <span className="mfw-loop__does">
            The conversation you are in. Everything below reports up into it.
          </span>
          <span className="mfw-loop__where">on this machine, in your chat</span>
        </div>
      </div>
      <span className="mfw-loop-layer__arrow" aria-hidden="true">
        &#8593; feeds up
      </span>
    </div>
  );
}

export function WaitingBand(): JSX.Element | null {
  const workspace = useWorkspace();
  const waiting = unplaced(workspace);
  const oneOff = placedAs(workspace, "one-off");
  if (waiting.length === 0 && oneOff.length === 0) return null;

  return (
    <section className="mfw-sessions" aria-label="Attached sessions">
      <header className="mfw-sessions__head">
        <h3>Attached from a machine</h3>
        <p className="mfw-sessions__line">
          {waiting.length === 0
            ? "Every one has a verdict."
            : `${waiting.length} still waiting on a verdict. Ask your agent to call place_session on each.`}
        </p>
      </header>
      <ul className="mfw-sessions__list">
        {waiting.map((session) => (
          <li className="mfw-session mfw-session--waiting" key={session.id}>
            <div className="mfw-session__name">{sessionTitle(session)}</div>
            <p className="mfw-session__what">{session.what}</p>
            <p className="mfw-session__why">not looked at yet</p>
          </li>
        ))}
        {oneOff.map((session) => (
          <li className="mfw-session" key={session.id}>
            <div className="mfw-session__name">{sessionTitle(session)}</div>
            <p className="mfw-session__why">not a loop: {session.why ?? "no reason given"}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OutsideBand(): JSX.Element | null {
  const workspace = useWorkspace();
  const done = listOutside(workspace);
  if (done.length === 0) return null;
  return (
    <section className="mfw-outside" aria-label="Done outside the loops">
      <header className="mfw-sessions__head">
        <h3>Done outside the loops</h3>
        <p className="mfw-sessions__line">
          Asked for once and finished. On the page so it is not invisible, off the loops so the
          picture keeps meaning what it says.
        </p>
      </header>
      {done.map((item) => (
        <p className="mfw-outside__item" key={item.id}>
          {item.what} <span className="mfw-outside__why">- {item.by}: {item.why}</span>
        </p>
      ))}
    </section>
  );
}

/** True when the page has something to show even with no loops registered. */
export function hasSessionContext(workspace: ReturnType<typeof useWorkspace>): boolean {
  return listSessions(workspace).length > 0 || listOutside(workspace).length > 0;
}
