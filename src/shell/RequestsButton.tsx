/**
 * The room thread, one click from anywhere on the page.
 *
 * Every note addressed to a person, to an agent or to the room lands in one list, so a
 * request handed to somebody else's agent and an answer coming back are the same thread
 * both humans are watching. The badge is the number still open, because a request nobody
 * can see is a request nobody does.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { RoomRequests, addressedFeedback } from "../feedback";
import { useWorkspace } from "./context";

const LABEL = "Requests";

export function RequestsButton(): JSX.Element {
  const workspace = useWorkspace();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement | null>(null);
  const count = addressedFeedback(workspace).length;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event: MouseEvent): void => {
      if (!wrap.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, close]);

  return (
    <span
      className="mfw-share-wrap"
      ref={wrap}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <button
        type="button"
        className="mfw-btn"
        aria-expanded={open}
        aria-label={count > 0 ? `${LABEL}, ${count} open` : LABEL}
        onClick={() => setOpen((value) => !value)}
      >
        {LABEL}
        {count > 0 ? <span className="mfw-req-badge">{count}</span> : null}
      </button>
      {open ? (
        <div className="mfw-share-pop mfw-req-pop">
          <RoomRequests />
        </div>
      ) : null}
    </span>
  );
}
