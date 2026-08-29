/** What the top bar and the centre say about the room this browser is in. Pure. */
import type { Workspace } from "../../types";

/** Names the store hands out before anybody renamed anything. */
export const DEFAULT_WORKSPACE_NAMES: readonly string[] = ["Demo workspace", "Live workspace"];

/** The name in the top bar: the board's own name, the slug, or the local board. */
export function roomTitle(workspace: Workspace, slug: string | null): string {
  if (slug === null) return "Local board";
  const name = workspace.name.trim();
  return name.length === 0 || DEFAULT_WORKSPACE_NAMES.includes(name) ? `Room ${slug}` : name;
}

/** Nothing on the board yet. The audit rail is ignored: a room join writes to it. */
export function boardIsEmpty(workspace: Workspace): boolean {
  return (
    Object.keys(workspace.categories).length === 0 &&
    workspace.overview === undefined &&
    Object.keys(workspace.monitors).length === 0 &&
    workspace.runs.length === 0 &&
    Object.keys(workspace.drafts).length === 0 &&
    Object.keys(workspace.feedback ?? {}).length === 0
  );
}

export interface KeyCheck {
  /** Envelopes this browser could not open. Only an encrypted room reports any. */
  readonly unreadable: number;
  readonly boardEmpty: boolean;
  readonly elapsedMs: number;
  readonly waitMs: number;
}

/**
 * The one honest reading of "this link's key is wrong": the relay is delivering, this
 * browser cannot open any of it, and nothing readable has arrived in the whole window.
 * Before the window is up it is indistinguishable from a slow room, so it says nothing.
 */
export function isWrongKey(check: KeyCheck): boolean {
  return check.unreadable > 0 && check.boardEmpty && check.elapsedMs >= check.waitMs;
}
