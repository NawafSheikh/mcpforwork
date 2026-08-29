/**
 * The pack controller: one object that answers "is this pack on right now" for the tool
 * registry and for registerAllTools, and that flips a switch on behalf of a person.
 *
 * It holds no state of its own. The truth is the workspace (a hand-flipped switch) plus
 * the room (whether we are in one), so a controller made here and the panel rendered by
 * usePacks always agree, and a switch flipped on one peer syncs like any other entity.
 */

import { displayName } from "../feedback/identity";
import type { Workspace, WorkspaceStore } from "../types";
import { inRoom, maySwitchPacks, subscribeHost, switchBlockedReason } from "./host";
import { packOfTool, type PackId } from "./registry";
import { enabledPackIds, packEnabled, packViews, setPackState, type PackView } from "./state";

export interface PackController {
  /** The pack a tool belongs to, or null for a tool no pack claims. */
  packOf(tool: string): string | null;
  enabled(packId: string): boolean;
  enabledIds(): readonly PackId[];
  views(): readonly PackView[];
  /** False in a room for everyone but the host. */
  maySwitch(): boolean;
  /** "" when you may switch, otherwise why not. */
  reason(): string;
  /** Refused silently when this browser is not the host; the panel disables the switch. */
  setPack(id: string, enabled: boolean): Promise<void>;
  /** Fires on every workspace commit and on every room or presence change. */
  subscribe(listener: () => void): () => void;
}

export function createPackController(store: WorkspaceStore): PackController {
  const ws = (): Workspace => store.get();
  return {
    packOf: (tool: string) => packOfTool(tool)?.id ?? null,
    enabled: (packId: string) => packEnabled(ws(), packId, inRoom()),
    enabledIds: () => enabledPackIds(ws(), inRoom()),
    views: () => packViews(ws(), inRoom()),
    maySwitch: maySwitchPacks,
    reason: switchBlockedReason,
    async setPack(id: string, enabled: boolean): Promise<void> {
      if (!maySwitchPacks()) return;
      const by = displayName();
      await store.update((current) => setPackState(current, { id, enabled, by }));
    },
    subscribe(listener: () => void): () => void {
      const stopStore = store.subscribe(() => listener());
      const stopHost = subscribeHost(listener);
      return () => {
        stopStore();
        stopHost();
      };
    },
  };
}
