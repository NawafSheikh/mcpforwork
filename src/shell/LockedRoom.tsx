/**
 * A room link that arrived without its key.
 *
 * Every room this build opens is encrypted, and the key is the part of the link after the
 * "#". Chat clients, ticket systems and copy-paste all like to eat that part, so this is a
 * common, boring accident with exactly one fix: ask for the whole link again. One
 * sentence, one action, no troubleshooting, and the words come from src/crypto/copy.ts so
 * the page and the docs cannot drift.
 */
import { LOCKED_ROOM_ACTION, LOCKED_ROOM_MESSAGE } from "../crypto";
import { leaveRoomUrl } from "../rooms";

export function LockedRoom(): JSX.Element {
  return (
    <main className="mfw-locked" role="main">
      <div className="mfw-locked-card">
        <span className="mfw-locked-mark" aria-hidden="true">
          MW
        </span>
        <h1 className="mfw-locked-title">MCP for Work</h1>
        <p className="mfw-locked-body">{LOCKED_ROOM_MESSAGE}</p>
        <a className="mfw-btn mfw-btn-primary" href={leaveRoomUrl()}>
          {LOCKED_ROOM_ACTION}
        </a>
      </div>
    </main>
  );
}
