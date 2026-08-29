/**
 * Invite: mint a room if there is none, then hand over a link.
 *
 * Two links, because two things get sent: the write link, which is the room, and a
 * read-only link for somebody who should watch and not edit. Both carry the same key in
 * v1, so the read link is a promise this page keeps and the panel says exactly that.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { buildInviteUrl, inviteToast, type RoomRole } from "../../crypto";
import {
  chooseTransport,
  createRoom,
  getRoomRuntime,
  inviteUrl,
  isJoinFailure,
  roomSecret,
  usePresence,
} from "../../rooms";
import { copyText } from "../lib/clipboard";
import { PUBLIC_ROOM_NOTE } from "../lib/constants";
import { Popover } from "./Popover";

const COPIED_MS = 2000;

const ROOM_NOTE =
  "Anyone with the whole link can join and edit. The room is encrypted and the relay never keeps your board.";

const READ_NOTE =
  "The read-only link opens the same room and this page will not write from it. It carries the same key, so it is a promise, not a permission.";

/** The two links for the open room, or null when this browser is not in one. */
function linksFor(slug: string): { readonly write: string; readonly read: string } {
  const secret = roomSecret();
  const write = inviteUrl(slug);
  const here = (globalThis as { location?: { href?: string } }).location?.href ?? write;
  return { write, read: secret === null ? write : buildInviteUrl(here, slug, secret, "read") };
}

export function InviteMenu(): JSX.Element {
  const presence = usePresence();
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async (role: RoomRole) => {
    if (timer.current !== null) clearTimeout(timer.current);
    const room = getRoomRuntime() ?? createRoom();
    if (isJoinFailure(room)) {
      setNote(chooseTransport().note);
      return;
    }
    const links = linksFor(room.slug);
    const copied = await copyText(role === "read" ? links.read : links.write);
    setNote(copied ? inviteToast(role) : "Copy blocked by the browser.");
    if (copied) timer.current = setTimeout(() => setNote(null), COPIED_MS);
  }, []);

  const isPublic = presence.slug !== null && roomSecret() === null;

  return (
    <Popover label="Invite" title={ROOM_NOTE} panelClass="mfw-pop--invite">
      <h4>Invite</h4>
      <p className="mfw-muted">{isPublic ? PUBLIC_ROOM_NOTE : ROOM_NOTE}</p>
      <div className="mfw-pop__actions">
        <button type="button" className="mfw-btn mfw-btn-primary" onClick={() => void copy("write")}>
          {presence.slug === null ? "Open a room and copy the link" : "Copy the room link"}
        </button>
        <button type="button" className="mfw-btn" onClick={() => void copy("read")}>
          Copy a read-only link
        </button>
      </div>
      <p className="mfw-pop__note">{READ_NOTE}</p>
      {note === null ? null : (
        <p className="mfw-muted" role="status">
          {note}
        </p>
      )}
    </Popover>
  );
}
