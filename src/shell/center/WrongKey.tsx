/**
 * The key in this link does not open this room.
 *
 * Chat clients, ticket systems and copy-paste all like to eat the part of a link after
 * the "#", and a key that arrives half-eaten decrypts nothing. The page only says this
 * once it is sure: envelopes are arriving, none of them open, and nothing readable has
 * landed in ten seconds (WRONG_KEY_MS). One sentence, one way out.
 */
import { LOCKED_ROOM_ACTION } from "../../crypto";
import { leaveRoomUrl } from "../../rooms";
import { WRONG_KEY_MESSAGE } from "../lib/constants";

export function WrongKey(): JSX.Element {
  return (
    <section className="mfw-card mfw-wrongkey" role="alert">
      <h2 className="mfw-page__title">This room will not open</h2>
      <p className="mfw-wrongkey__body">{WRONG_KEY_MESSAGE}</p>
      <a className="mfw-btn mfw-btn-primary" href={leaveRoomUrl()}>
        {LOCKED_ROOM_ACTION}
      </a>
    </section>
  );
}
