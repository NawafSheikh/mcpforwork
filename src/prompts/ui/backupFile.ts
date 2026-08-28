/**
 * Backup helpers: a board to a file and back.
 *
 * The file is the share snapshot in plain JSON, so it carries the categories, the
 * overview, the monitors, the runs, the drafts and the feedback, and deliberately not
 * the audit trail: that is the record of what happened on this machine.
 *
 * Reading one goes through fromSnapshot, the same defensive coercion a share link gets,
 * because a file on disk is no more trustworthy than a link in a chat.
 */
import { SHARED_SUFFIX, fromSnapshot, toSnapshot } from "../../share";
import type { Workspace } from "../../types";

export const BACKUP_TOOL = "restore";

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/** mcpforwork-board-YYYYMMDD-HHmm.json, in the reader's own local time. */
export function backupFileName(now: Date = new Date()): string {
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `mcpforwork-board-${day}-${time}.json`;
}

export function backupJson(ws: Workspace): string {
  return JSON.stringify(toSnapshot(ws), null, 2);
}

/** Hand the file to the browser through an object URL, then let it go again. */
export function downloadJson(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function ownName(name: string): string {
  return name.endsWith(SHARED_SUFFIX) ? name.slice(0, -SHARED_SUFFIX.length) : name;
}

/**
 * Untrusted JSON text to a workspace that can replace this one. The identity of the
 * board (its id and its mode) stays local; only the contents come from the file.
 */
export function restoreFrom(text: string, current: Workspace): Workspace | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const coerced = fromSnapshot(raw);
  if (coerced === null) return null;
  return { ...coerced, id: current.id, name: ownName(coerced.name), mode: current.mode };
}

export function categoryCount(ws: Workspace): number {
  return Object.keys(ws.categories).length;
}
