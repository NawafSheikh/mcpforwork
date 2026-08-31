/**
 * Sessions attached off somebody's machine, and what became of each one.
 *
 * The bridge lists what is running (mcpforwork-bridge/src/packs/sessions.ts). This is the
 * board's side: which of those a person ticked, and the verdict the agent then reached on
 * each. Two separate acts, and keeping them separate is the design:
 *
 *   attaching is a person's        - only they know which of their sessions this board is about
 *   placing is the agent's         - and it has to say why, per session, in writing
 *
 * A session the agent cannot justify as a loop does not vanish. It is recorded as one-off
 * with a reason, because "not shown" and "not looked at" are the same picture otherwise.
 */

import { LIMITS, type AttachedSession, type OutsideWork, type SessionPlacement, type Workspace } from "../types";

export function listSessions(ws: Workspace): readonly AttachedSession[] {
  return Object.values(ws.sessions ?? {}).sort((a, b) => a.attachedAt.localeCompare(b.attachedAt));
}

export function sessionById(ws: Workspace, id: string): AttachedSession | null {
  return (ws.sessions ?? {})[id] ?? null;
}

/** A session an agent has not ruled on yet. This list emptying is the job being done. */
export function unplaced(ws: Workspace): readonly AttachedSession[] {
  return listSessions(ws).filter((session) => session.placement === "unplaced");
}

export function placedAs(ws: Workspace, placement: SessionPlacement): readonly AttachedSession[] {
  return listSessions(ws).filter((session) => session.placement === placement);
}

/** Whose machines are represented, so the board can say how many it is spanning. */
export function sessionHosts(ws: Workspace): readonly string[] {
  return [...new Set(listSessions(ws).map((session) => session.host))].sort();
}

/**
 * Attach, dropping the oldest once full.
 *
 * Re-attaching a session already on the board keeps the verdict it already has: the point
 * of reopening a workspace is that yesterday's reasoning is still there, and a person
 * ticking the same session again is not asking for it to be reconsidered.
 */
export function attach(ws: Workspace, incoming: readonly AttachedSession[]): Workspace {
  const existing = ws.sessions ?? {};
  const next: Record<string, AttachedSession> = { ...existing };
  for (const session of incoming) {
    const already = existing[session.id];
    next[session.id] = already === undefined ? session : { ...session, placement: already.placement, ...(already.why === undefined ? {} : { why: already.why }), ...(already.loop === undefined ? {} : { loop: already.loop }) };
  }
  return { ...ws, sessions: withRoom(next, LIMITS.maxSessions, (item) => item.attachedAt) };
}

export function place(
  ws: Workspace,
  id: string,
  placement: SessionPlacement,
  why: string,
  loop?: string,
): Workspace {
  const session = sessionById(ws, id);
  if (session === null) return ws;
  const next: AttachedSession = {
    ...session,
    placement,
    why,
    ...(loop === undefined ? {} : { loop }),
  };
  return { ...ws, sessions: { ...(ws.sessions ?? {}), [id]: next } };
}

export function detach(ws: Workspace, id: string): Workspace {
  const rest = Object.fromEntries(Object.entries(ws.sessions ?? {}).filter(([key]) => key !== id));
  return { ...ws, sessions: rest };
}

/* ------------------------------------------------------ work outside the loops */

export function listOutside(ws: Workspace): readonly OutsideWork[] {
  return Object.values(ws.outside ?? {}).sort((a, b) => b.at.localeCompare(a.at));
}

export function noteOutside(ws: Workspace, item: OutsideWork): Workspace {
  const next = { ...(ws.outside ?? {}), [item.id]: item };
  return { ...ws, outside: withRoom(next, LIMITS.maxOutside, (entry) => entry.at) };
}

/** Drop the oldest once a record is full, so a long session cannot grow without bound. */
function withRoom<T>(
  all: Readonly<Record<string, T>>,
  max: number,
  stamp: (item: T) => string,
): Record<string, T> {
  const entries = Object.entries(all);
  if (entries.length <= max) return Object.fromEntries(entries);
  const oldest = [...entries].sort((a, b) => stamp(a[1]).localeCompare(stamp(b[1])));
  const drop = new Set(oldest.slice(0, entries.length - max).map(([key]) => key));
  return Object.fromEntries(entries.filter(([key]) => !drop.has(key)));
}
