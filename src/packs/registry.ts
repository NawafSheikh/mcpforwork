/**
 * The pack registry (docs/PACKS.md): which site tool belongs to which switch.
 *
 * A leaf on purpose. It names its tools as plain strings and imports nothing from
 * src/webmcp, so the tool schemas can merge the capability tools in without a cycle.
 * The test in __tests__/registry.test.ts asserts these names are exactly TOOL_NAMES,
 * each one in exactly one pack, so the two lists can never drift apart in silence.
 */

import type { PackRisk } from "../types";

export const PACK_IDS = [
  "board",
  "workspaces",
  "datasets",
  "notes",
  "turns",
  "monitors",
  "rooms",
] as const;

export type PackId = (typeof PACK_IDS)[number];

export interface PackDefinition {
  readonly id: PackId;
  readonly name: string;
  readonly description: string;
  /** What this pack can do at its worst. Shown next to the switch. */
  readonly risk: PackRisk;
  readonly tools: readonly string[];
}

/**
 * The six built-in packs. Every tool the page publishes sits in exactly one of them.
 *
 * Only `monitors` is `send`: it is the pack that proposes and approves actions in the
 * world, so it is the one that can spend somebody's money. Everything else reads the
 * board or writes to it, which is undoable and stays on the page.
 */
export const BUILT_IN_PACKS: readonly PackDefinition[] = [
  {
    id: "board",
    name: "Board",
    description: "Categories, dashboards and the overview: the objects the page is made of.",
    risk: "write",
    tools: [
      "get_workspace",
      "create_category",
      "upsert_dataset_summary",
      "upsert_dashboard",
      "get_dashboard",
      "compose_overview",
      "clear_workspace",
    ],
  },
  {
    id: "workspaces",
    name: "Workspaces",
    description:
      "More than one board in this browser: make one per project, switch between them, save. Deleting one is a person's job, so there is no tool for it.",
    risk: "write",
    tools: [
      "list_workspaces",
      "create_workspace",
      "switch_workspace",
      "rename_workspace",
      "save_workspace",
    ],
  },
  {
    id: "datasets",
    name: "Datasets",
    description: "Profile and aggregate files a person dropped here. The rows never leave the browser.",
    risk: "write",
    tools: [
      "list_datasets",
      "get_dataset_profile",
      "aggregate_dataset",
      "attach_dataset_to_category",
    ],
  },
  {
    id: "notes",
    name: "Notes",
    description: "Requests in all four directions: person to person, person to agent, agent to person, agent to agent.",
    risk: "write",
    tools: ["add_feedback", "list_feedback", "resolve_feedback"],
  },
  {
    id: "turns",
    name: "Turns",
    description: "Claims and versions, so two agents on one object merge instead of overwriting.",
    risk: "write",
    tools: ["claim", "release", "list_claims"],
  },
  {
    id: "monitors",
    name: "Monitors",
    description: "Policies, scheduled runs and the approval queue. This is the pack that can act on the outside.",
    risk: "write",
    tools: [
      "register_monitor",
      "report_monitor_run",
      "list_monitors",
      "get_run_log",
      "approve_draft",
      "decline_draft",
      "set_policy",
    ],
  },
  {
    id: "rooms",
    name: "Rooms",
    description: "Invite, presence, read-only snapshot links, and the capability cards of everyone here.",
    risk: "write",
    tools: ["get_room", "create_room", "share_board", "publish_capabilities", "list_capabilities"],
  },
];

const BY_ID: ReadonlyMap<string, PackDefinition> = new Map(
  BUILT_IN_PACKS.map((pack) => [pack.id, pack]),
);

const BY_TOOL: ReadonlyMap<string, PackDefinition> = new Map(
  BUILT_IN_PACKS.flatMap((pack) => pack.tools.map((tool) => [tool, pack] as const)),
);

/** Every tool that belongs to a pack, in pack order. */
export const PACK_TOOL_NAMES: readonly string[] = BUILT_IN_PACKS.flatMap((pack) => pack.tools);

export function packById(id: string): PackDefinition | null {
  return BY_ID.get(id) ?? null;
}

/** The pack a tool belongs to, or null for a tool no pack claims (a bridge tool). */
export function packOfTool(tool: string): PackDefinition | null {
  return BY_TOOL.get(tool) ?? null;
}

export function isPackId(id: string): id is PackId {
  return BY_ID.has(id);
}

/**
 * Whether a pack nobody has touched is on. Everything is on for one person on their own
 * board; anything that sends or moves starts off once other people are in the room,
 * because a room is other people's tools as well as yours (docs/PACKS.md).
 */
export function defaultEnabled(pack: PackDefinition, inRoom: boolean): boolean {
  if (!inRoom) return true;
  return pack.risk !== "send" && pack.risk !== "move";
}

/** The one sentence an agent gets when it calls a tool whose pack is switched off. */
export function packOffText(packId: string): string {
  return `The ${packId} pack is off in this room; ask the host.`;
}

/** "7 tools, can send" for the chip next to the switch. */
export function packRiskLabel(pack: PackDefinition): string {
  switch (pack.risk) {
    case "read":
      return "reads only";
    case "write":
      return "writes here";
    case "send":
      return "can send";
    default:
      return "can move things";
  }
}
