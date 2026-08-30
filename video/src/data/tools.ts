/**
 * The registered WebMCP surface, mirrored from the app so the film cannot drift
 * from the product: src/packs/registry.ts for the packs, src/webmcp/annotations.ts
 * for the read-only set. 34 tools, 13 of them read-only.
 */

export interface Tool {
  readonly name: string;
  readonly pack: string;
  readonly readOnly: boolean;
}

const READ_ONLY = new Set([
  "get_workspace",
  "get_dashboard",
  "list_monitors",
  "get_run_log",
  "list_feedback",
  "share_board",
  "get_room",
  "list_datasets",
  "get_dataset_profile",
  "aggregate_dataset",
  "list_claims",
  "list_capabilities",
  "list_workspaces",
]);

const BY_PACK: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    "board",
    [
      "get_workspace",
      "create_category",
      "upsert_dataset_summary",
      "upsert_dashboard",
      "get_dashboard",
      "compose_overview",
      "clear_workspace",
    ],
  ],
  [
    "workspaces",
    ["list_workspaces", "create_workspace", "switch_workspace", "rename_workspace", "save_workspace"],
  ],
  [
    "datasets",
    ["list_datasets", "get_dataset_profile", "aggregate_dataset", "attach_dataset_to_category"],
  ],
  ["notes", ["add_feedback", "list_feedback", "resolve_feedback"]],
  ["turns", ["claim", "release", "list_claims"]],
  [
    "monitors",
    [
      "register_monitor",
      "report_monitor_run",
      "list_monitors",
      "get_run_log",
      "approve_draft",
      "decline_draft",
      "set_policy",
    ],
  ],
  ["rooms", ["get_room", "create_room", "share_board", "publish_capabilities", "list_capabilities"]],
];

export const PACKS: readonly string[] = BY_PACK.map(([id]) => id);

export const TOOLS: readonly Tool[] = BY_PACK.flatMap(([pack, names]) =>
  names.map((name) => ({ name, pack, readOnly: READ_ONLY.has(name) })),
);

export const TOOL_COUNT = TOOLS.length;
export const READ_ONLY_COUNT = TOOLS.filter((t) => t.readOnly).length;
export const WRITE_COUNT = TOOL_COUNT - READ_ONLY_COUNT;

/** The order the tools were actually called in on 28 August 2026 (Activity rail). */
export const REAL_RUN_SEQUENCE: readonly string[] = [
  "get_workspace",
  "create_category",
  "upsert_dataset_summary",
  "upsert_dashboard",
  "compose_overview",
  "register_monitor",
  "report_monitor_run",
  "approve_draft",
];
