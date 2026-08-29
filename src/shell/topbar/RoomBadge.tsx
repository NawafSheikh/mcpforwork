/**
 * What kind of board this is, in one badge, and it never overstates it.
 *
 * Three states and three sentences: a local board that never left this browser, a public
 * room that anybody with the link can read and write, and an encrypted room whose key
 * lives in the link fragment and whose fingerprint two people can compare out loud.
 */
import { ENCRYPTED_BADGE, lockBadgeLabel } from "../../crypto";
import { usePresence, roomFingerprint } from "../../rooms";
import {
  LOCAL_BOARD_LABEL,
  LOCAL_BOARD_NOTE,
  PUBLIC_ROOM_LABEL,
  PUBLIC_ROOM_NOTE,
} from "../lib/constants";

export interface RoomBadgeProps {
  readonly inRoom: boolean;
  /** The key fingerprint, or null when this room carries no key at all. */
  readonly fingerprint: string | null;
}

export function RoomBadge({ inRoom, fingerprint }: RoomBadgeProps): JSX.Element {
  if (!inRoom) {
    return (
      <span className="mfw-pill" title={LOCAL_BOARD_NOTE}>
        {LOCAL_BOARD_LABEL}
      </span>
    );
  }
  if (fingerprint === null) {
    return (
      <span className="mfw-pill mfw-pill-warn" title={PUBLIC_ROOM_NOTE}>
        {PUBLIC_ROOM_LABEL}
      </span>
    );
  }
  return (
    <span className="mfw-pill mfw-pill-ok" title={ENCRYPTED_BADGE}>
      {`\u{1F512} ${lockBadgeLabel(fingerprint)}`}
    </span>
  );
}

/** The same badge, wired to the room this page is actually in. */
export function LiveRoomBadge(): JSX.Element {
  const presence = usePresence();
  return <RoomBadge inRoom={presence.slug !== null} fingerprint={roomFingerprint()} />;
}
