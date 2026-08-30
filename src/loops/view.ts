/**
 * What the loop picture says, worked out away from the drawing.
 *
 * Pure on purpose: the graph is the centrepiece of this product, so the sentences in it
 * are tested rather than eyeballed. The renderer walks these rows and draws boxes.
 */

import type { Loop, Workspace } from "../types";
import { feeders, layers, listLoops, loopById } from "./state";

export interface LoopRow {
  readonly loop: Loop;
  /** Names of the loops feeding this one, for the line under the box. */
  readonly fedBy: readonly string[];
  /** The name of the loop this one feeds, or null. */
  readonly feedsName: string | null;
  /** True when this loop runs somewhere other than the browser reading it. */
  readonly remote: boolean;
}

export interface LoopLayerRow {
  readonly layer: number;
  readonly rows: readonly LoopRow[];
}

/**
 * The layers, floor first, each loop carrying what it needs to be drawn.
 * `mine` is the caller name of the agent attached to this browser, so the picture can say
 * which boxes are somebody else's machine without pretending to know more than it does.
 */
export function loopRows(ws: Workspace, mine: string | null): readonly LoopLayerRow[] {
  return layers(ws).map((row, layer) => ({
    layer,
    rows: row.map((loop) => ({
      loop,
      fedBy: feeders(ws, loop.id).map((item) => item.name),
      feedsName: loop.feeds === undefined ? null : (loopById(ws, loop.feeds)?.name ?? null),
      remote: mine !== null && loop.host.toLowerCase() !== mine.toLowerCase(),
    })),
  }));
}

/** "on Ana's Claude, every 10 minutes" for the line under a loop's name. */
export function whereLine(loop: Loop): string {
  const every = loop.every === undefined ? "" : `, ${loop.every}`;
  return `on ${loop.host}${every}`;
}

/** What a loop last said, or an honest blank rather than an invented one. */
export function saidLine(loop: Loop): string {
  if (loop.lastSaid !== undefined) return loop.lastSaid;
  return loop.lastRunAt === undefined ? "has not reported yet" : "reported nothing";
}

/**
 * The sentence a person says to change this loop.
 *
 * There is no chat box on this page, and there should not be: a person talks to their own
 * agent, in the chat they are already in. So clicking a loop hands them the words. When
 * the loop belongs to somebody else's agent, the words become a request their agent will
 * pick up from its own list_feedback, because that is the only way to reach it.
 */
export function talkPrompt(row: LoopRow): string {
  const { loop, remote } = row;
  if (!remote) {
    return (
      `On mcpforwork.com, change the loop "${loop.name}" (${loop.id}): it currently ${loop.does}. ` +
      "Tell me what it would take, then call rearrange_loop or register_loop to update it and " +
      "report_loop with what you changed."
    );
  }
  return (
    `On mcpforwork.com, call add_feedback addressed to the agent "${loop.host}" about the loop ` +
    `"${loop.name}" (${loop.id}), which runs on their machine. Say what I want changed and why. ` +
    "Their agent picks it up from its own list_feedback."
  );
}

/** The one line under the picture: how much is running, and where. */
export function pictureLine(ws: Workspace): string {
  const all = listLoops(ws);
  if (all.length === 0) return "Nothing is running yet.";
  const machines = new Set(all.map((loop) => loop.host)).size;
  const live = all.filter((loop) => loop.state === "running").length;
  const stuck = all.filter((loop) => loop.state === "failed" || loop.state === "held").length;
  const parts = [
    `${all.length} ${all.length === 1 ? "loop" : "loops"}`,
    `${machines} ${machines === 1 ? "machine" : "machines"}`,
  ];
  if (live > 0) parts.push(`${live} running now`);
  if (stuck > 0) parts.push(`${stuck} wanting a person`);
  return `${parts.join(", ")}.`;
}
