/**
 * usePacks(): the switches, whether this browser may move them, and why not.
 *
 * A plain useState mirror rather than useSyncExternalStore, because views() builds a
 * fresh array on every call and React would spin on an unstable snapshot. The controller
 * reads the workspace and the room, so the panel and the registered tools cannot drift.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useShell } from "../shell/context";
import { createPackController, type PackController } from "./controller";
import type { PackView } from "./state";

export interface PacksApi {
  readonly packs: readonly PackView[];
  /** False in a room for everyone but the host. */
  readonly maySwitch: boolean;
  /** "" when you may switch, otherwise the sentence to show under the switches. */
  readonly reason: string;
  setPack(id: string, enabled: boolean): void;
}

interface Snapshot {
  readonly packs: readonly PackView[];
  readonly maySwitch: boolean;
  readonly reason: string;
}

const read = (controller: PackController): Snapshot => ({
  packs: controller.views(),
  maySwitch: controller.maySwitch(),
  reason: controller.reason(),
});

export function usePacks(): PacksApi {
  const { store } = useShell();
  const controller = useMemo(() => createPackController(store), [store]);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => read(controller));

  useEffect(() => {
    setSnapshot(read(controller));
    return controller.subscribe(() => setSnapshot(read(controller)));
  }, [controller]);

  const setPack = useCallback(
    (id: string, enabled: boolean) => {
      void controller.setPack(id, enabled);
    },
    [controller],
  );

  return { ...snapshot, setPack };
}
