/**
 * Pack switches on the Workspace: reading them, and flipping one.
 *
 * A pack with no entry in `ws.packs` is at its built-in default, so a board nobody has
 * touched carries no pack state at all and a joiner computes the same answer from the
 * same rules. Only a hand-flipped switch is stored, and storing it is what syncs it.
 */

import type { PackState, Workspace } from "../types";
import {
  BUILT_IN_PACKS,
  defaultEnabled,
  packById,
  type PackDefinition,
  type PackId,
} from "./registry";

/** One row of the Tools panel: the pack, its switch, and who last moved it. */
export interface PackView {
  readonly pack: PackDefinition;
  readonly enabled: boolean;
  /** Absent while the pack is still at its default. */
  readonly changedBy?: string;
  readonly changedAt?: string;
}

const packsOf = (ws: Workspace): Readonly<Record<string, PackState>> => ws.packs ?? {};

export function packStateOf(ws: Workspace, id: string): PackState | null {
  return packsOf(ws)[id] ?? null;
}

/** True when this pack's tools are registered right now. */
export function packEnabled(ws: Workspace, id: string, inRoom: boolean): boolean {
  const pack = packById(id);
  if (pack === null) return true;
  return packStateOf(ws, id)?.enabled ?? defaultEnabled(pack, inRoom);
}

export function packView(ws: Workspace, pack: PackDefinition, inRoom: boolean): PackView {
  const stored = packStateOf(ws, pack.id);
  if (stored === null) return { pack, enabled: defaultEnabled(pack, inRoom) };
  return {
    pack,
    enabled: stored.enabled,
    changedBy: stored.changedBy,
    changedAt: stored.changedAt,
  };
}

/** Every pack with its switch, in registry order. This is what the panel renders. */
export function packViews(ws: Workspace, inRoom: boolean): readonly PackView[] {
  return BUILT_IN_PACKS.map((pack) => packView(ws, pack, inRoom));
}

/** The packs whose tools should be on the page right now. */
export function enabledPackIds(ws: Workspace, inRoom: boolean): readonly PackId[] {
  return BUILT_IN_PACKS.filter((pack) => packEnabled(ws, pack.id, inRoom)).map((pack) => pack.id);
}

export interface SetPackInput {
  readonly id: string;
  readonly enabled: boolean;
  /** Display name of the person, or caller name of the agent, doing the flipping. */
  readonly by: string;
  readonly at?: string;
}

/**
 * Flip one switch. Returns the same workspace when nothing would change, so the store
 * does not commit a no-op and the room does not gossip one.
 */
export function setPackState(ws: Workspace, input: SetPackInput): Workspace {
  const pack = packById(input.id);
  if (pack === null) return ws;
  const current = packStateOf(ws, input.id);
  if (current !== null && current.enabled === input.enabled) return ws;
  const next: PackState = {
    id: pack.id,
    enabled: input.enabled,
    changedBy: input.by,
    changedAt: input.at ?? new Date().toISOString(),
  };
  return { ...ws, packs: { ...packsOf(ws), [pack.id]: next } };
}

/** "Maria switched it off" for the row, or "" while the pack is at its default. */
export function changedByText(view: PackView): string {
  if (view.changedBy === undefined) return "";
  return `${view.changedBy} switched it ${view.enabled ? "on" : "off"}`;
}
