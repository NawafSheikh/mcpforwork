/**
 * Human edits on the board, routed through the same store the agent writes to.
 * Every one is audited as actor "human" with tool "human_edit", so the activity
 * rail shows exactly who changed what and the agent can read it back.
 */

import { useCallback, useMemo } from "react";
import { useShell } from "../../context";
import { withAudit } from "../../adapters/store";
import {
  applyInsert,
  applyMove,
  applyRemove,
  applyRename,
  applyReplace,
  chartAt,
  targetLabel,
  type EditTarget,
} from "./mutate";
import type { Chart, Workspace } from "../../../types";

const TOOL = "human_edit";

export interface RemovedChart {
  readonly target: EditTarget;
  readonly index: number;
  readonly chart: Chart;
}

export interface BoardEdits {
  rename(target: EditTarget, title: string): void;
  move(target: EditTarget, index: number, delta: number): void;
  remove(target: EditTarget, index: number): void;
  restore(removed: RemovedChart): void;
  keep(target: EditTarget, index: number, chart: Chart): void;
  pin(name: string, pinned: boolean): void;
}

/** onRemoved receives the chart that was dropped, so the caller can offer undo. */
export function useBoardEdits(onRemoved?: (removed: RemovedChart) => void): BoardEdits {
  const { store } = useShell();

  const run = useCallback(
    (change: (ws: Workspace, at: string) => Workspace, args: unknown, result: string): void => {
      void store.update((ws) =>
        withAudit(change(ws, new Date().toISOString()), { actor: "human", tool: TOOL, args, result }),
      );
    },
    [store],
  );

  return useMemo<BoardEdits>(
    () => ({
      rename(target, title) {
        const label = targetLabel(target);
        run(
          (ws, at) => applyRename(ws, target, title, at),
          { edit: "rename", target: label, title },
          `Renamed ${label} to "${title.trim()}"`,
        );
      },

      move(target, index, delta) {
        const label = targetLabel(target);
        const where = delta < 0 ? "up" : "down";
        run(
          (ws, at) => applyMove(ws, target, index, delta, at),
          { edit: "reorder", target: label, index, delta },
          `Moved chart ${index + 1} ${where} on ${label}`,
        );
      },

      remove(target, index) {
        const label = targetLabel(target);
        const chart = chartAt(store.get(), target, index);
        if (!chart) return;
        run(
          (ws, at) => applyRemove(ws, target, index, at),
          { edit: "delete_chart", target: label, chart: chart.title },
          `Removed chart "${chart.title}" from ${label}`,
        );
        onRemoved?.({ target, index, chart });
      },

      restore(removed) {
        const label = targetLabel(removed.target);
        run(
          (ws, at) => applyInsert(ws, removed.target, removed.index, removed.chart, at),
          { edit: "undo_delete", target: label, chart: removed.chart.title },
          `Restored chart "${removed.chart.title}" on ${label}`,
        );
      },

      keep(target, index, chart) {
        const label = targetLabel(target);
        run(
          (ws, at) => applyReplace(ws, target, index, chart, at),
          { edit: "keep_view", target: label, chart: chart.title, kind: chart.kind },
          `Kept the ${chart.kind} view of "${chart.title}" on ${label}`,
        );
      },

      pin(name, pinned) {
        run(
          (ws) => ws,
          { edit: pinned ? "pin" : "unpin", target: name },
          `${pinned ? "Pinned" : "Unpinned"} ${name}`,
        );
      },
    }),
    [onRemoved, run, store],
  );
}
