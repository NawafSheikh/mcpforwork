/**
 * The pieces every feedback thread paints: who wrote a note, who it is for, and the
 * open and resolved rows. FeedbackBox and RoomRequests share them so a note left on a
 * dashboard and a note left for another person's agent read the same way.
 */
import type { Feedback, FeedbackTarget } from "../../types";
import { ANY_ONE } from "../store";

const AGENT_FALLBACK = "ChatGPT";

/** Coarse on purpose: a note is either fresh, from today, or old news. */
export function age(iso: string, from: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((from - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** "Agent · Classify 1-25", "Person · Maria", or plain "You" for an unsigned note. */
export function authorLabel(item: Feedback): string {
  if (item.author === "system") return "System";
  if (item.author === "agent") return `Agent · ${item.from ?? AGENT_FALLBACK}`;
  return item.from ? `Person · ${item.from}` : "You";
}

/** The "for ..." chip, only on notes addressed to somebody rather than to an object. */
export function targetLabel(target: FeedbackTarget): string | null {
  if (target.kind === "room") return "for this room";
  if (target.kind === "agent") {
    return target.id === ANY_ONE ? "for any agent" : `for agent ${target.id}`;
  }
  if (target.kind === "person") {
    return target.id === ANY_ONE ? "for everyone" : `for person ${target.id}`;
  }
  return null;
}

export function NoteHead({ item }: { readonly item: Feedback }): JSX.Element {
  const forWhom = targetLabel(item.target);
  return (
    <span className="mfw-fb-head">
      <span className={`mfw-fb-author mfw-fb-author-${item.author}`}>{authorLabel(item)}</span>
      {forWhom === null ? null : <span className="mfw-fb-for">{forWhom}</span>}
      <span className="mfw-fb-age">{age(item.createdAt)}</span>
    </span>
  );
}

export function OpenNote({
  item,
  onResolve,
}: {
  readonly item: Feedback;
  readonly onResolve: (id: string) => void;
}): JSX.Element {
  return (
    <li className="mfw-fb-note">
      <NoteHead item={item} />
      <p className="mfw-fb-text">{item.text}</p>
      <button type="button" className="mfw-fb-resolve" onClick={() => onResolve(item.id)}>
        Resolve
      </button>
    </li>
  );
}

export function ResolvedNote({ item }: { readonly item: Feedback }): JSX.Element {
  return (
    <li className="mfw-fb-note mfw-fb-note-done">
      <NoteHead item={item} />
      <p className="mfw-fb-text">{item.text}</p>
      {item.resolution ? <p className="mfw-fb-resolution">{item.resolution}</p> : null}
    </li>
  );
}

export function NoteList({
  items,
  onResolve,
}: {
  readonly items: readonly Feedback[];
  readonly onResolve?: (id: string) => void;
}): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <ol className="mfw-fb-list">
      {items.map((item) =>
        onResolve === undefined ? (
          <ResolvedNote key={item.id} item={item} />
        ) : (
          <OpenNote key={item.id} item={item} onResolve={onResolve} />
        ),
      )}
    </ol>
  );
}
