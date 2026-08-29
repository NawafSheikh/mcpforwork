/**
 * The first thing on mcpforwork.com: a live public room, then the hero.
 *
 * A newcomer sees the room working before they do anything, so the card comes first and
 * the explanation second. One button joins; nothing else is asked. The room is public and
 * unencrypted by design (docs/UI.md), which is the only reason its presence is readable
 * from outside it.
 */
import { useCallback, useState } from "react";
import { Hero } from "../../onboarding";
import { chooseTransport, isJoinFailure, joinRoom, roomJoinUrl } from "../../rooms";
import { useWebmcpStatus } from "../context";
import {
  ROBOT_STATUS,
  SHOWCASE_ROOM,
  SHOWCASE_UNKNOWN,
  START_COLLABORATING,
} from "../lib/constants";
import { useShowcase, type ShowcaseState } from "../lib/showcase";

const LEAD = "A public room, open right now. Join it and your agent joins with you.";

export function presenceLine(state: ShowcaseState): string {
  if (state.status !== "seen") return SHOWCASE_UNKNOWN;
  const people = `${state.people} ${state.people === 1 ? "person" : "people"}`;
  const agents = `${state.agents} ${state.agents === 1 ? "agent" : "agents"}`;
  return `${people}, ${agents} here`;
}

export function robotLine(): string {
  return `${ROBOT_STATUS.name}: ${ROBOT_STATUS.state}, last run ${ROBOT_STATUS.lastRun}`;
}

function RoomCard(): JSX.Element {
  const showcase = useShowcase(SHOWCASE_ROOM);
  const [note, setNote] = useState<string | null>(null);

  const onJoin = useCallback(() => {
    const room = joinRoom(SHOWCASE_ROOM);
    if (isJoinFailure(room)) setNote(chooseTransport().note);
  }, []);

  return (
    <section className="mfw-card mfw-live-room">
      <p className="mfw-live-room__eyebrow">Live public room</p>
      <h2 className="mfw-live-room__code">{SHOWCASE_ROOM}</h2>
      <p className="mfw-muted">{LEAD}</p>
      <p className="mfw-live-room__presence" role="status">
        {presenceLine(showcase)}
      </p>
      <p className="mfw-live-room__robot">{robotLine()}</p>
      <div className="mfw-live-room__actions">
        <button type="button" className="mfw-btn mfw-btn-primary" onClick={onJoin}>
          {START_COLLABORATING}
        </button>
        <a className="mfw-btn" href={roomJoinUrl(SHOWCASE_ROOM)}>
          Open the room link
        </a>
      </div>
      {note === null ? null : (
        <p className="mfw-muted" role="status">
          {note}
        </p>
      )}
    </section>
  );
}

export function LandingPage(): JSX.Element {
  const status = useWebmcpStatus();
  return (
    <div className="mfw-page mfw-landing">
      {status.available ? null : <RoomCard />}
      <Hero />
    </div>
  );
}
