/**
 * "What you control": five rows, each with the state it is in and one thing to do.
 *
 * Pure on purpose. The first run has to answer "where is my agent and what can I touch"
 * without a tour, and the honest answer is the five surfaces this page owns. Every row
 * reads its state from the board, so an empty board says empty and never pretends.
 */

export type ControlId = "board" | "guardrails" | "tools" | "rooms" | "data";

export interface ControlRow {
  readonly id: ControlId;
  readonly label: string;
  /** What this surface holds right now, in plain words. */
  readonly state: string;
  /** The label on the one action in the row. */
  readonly action: string;
}

export interface ControlInput {
  readonly categories: number;
  readonly monitors: number;
  /** Tools registered by the packs that are on, and how many exist in total. */
  readonly toolsOn: number;
  readonly toolsTotal: number;
  readonly packsOn: number;
  readonly packsTotal: number;
  /** The room this board is in, or null for this browser alone. */
  readonly room: string | null;
  readonly people: number;
  readonly datasets: number;
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export function boardState(categories: number): string {
  return categories === 0 ? "empty, your agent builds it" : plural(categories, "category", "categories");
}

export function toolsState(input: ControlInput): string {
  if (input.packsOn === input.packsTotal) {
    return `${input.toolsTotal} tools in ${input.packsTotal} packs, all on`;
  }
  return `${input.toolsOn} of ${input.toolsTotal} tools, ${input.packsOn} of ${input.packsTotal} packs on`;
}

export function roomsState(input: ControlInput): string {
  if (input.room === null) return "only this browser";
  return `${input.room}, ${plural(input.people, "member", "members")}`;
}

/** The five rows, always in this order: the work, the rules, the reach, the people, the data. */
export function controlRows(input: ControlInput): readonly ControlRow[] {
  return [
    { id: "board", label: "Board", state: boardState(input.categories), action: "Open the board" },
    {
      id: "guardrails",
      label: "Guardrails",
      state: input.monitors === 0 ? "no monitors yet" : plural(input.monitors, "monitor", "monitors"),
      action: "Monitors",
    },
    { id: "tools", label: "Tools", state: toolsState(input), action: "Tools" },
    { id: "rooms", label: "Rooms", state: roomsState(input), action: "Invite" },
    {
      id: "data",
      label: "Data",
      state: input.datasets === 0 ? "nothing dropped" : plural(input.datasets, "dataset", "datasets"),
      action: "Datasets",
    },
  ];
}
