/**
 * Tool annotations in one place so definitions.ts and register.ts cannot drift.
 * readOnlyHint marks tools that never change the workspace.
 * untrustedContentHint marks tools that echo text derived from the visitor's own data
 * (category names, dashboard titles, findings), which the agent must not treat as
 * instructions.
 */

import type { ToolAnnotations } from "../types";
import {
  CAPABILITY_READ_ONLY_TOOLS,
  CAPABILITY_UNTRUSTED_TOOLS,
} from "../capabilities/tools";
import { DATASET_READ_ONLY_TOOLS, DATASET_UNTRUSTED_TOOLS } from "../dataset/definitions";
import { ROOM_READ_ONLY_TOOLS, ROOM_UNTRUSTED_CONTENT_TOOLS } from "../rooms/handlers";
import { TURN_READ_ONLY_TOOLS, TURN_UNTRUSTED_CONTENT_TOOLS } from "../turns/tools";
import { WORKSPACE_READ_ONLY_TOOLS, WORKSPACE_UNTRUSTED_TOOLS } from "../workspaces/tools";
import type { ToolName } from "./schemas";

export const READ_ONLY_TOOLS: readonly ToolName[] = [
  "get_workspace",
  "get_dashboard",
  "list_monitors",
  "get_run_log",
  "list_feedback",
  "share_board",
  ...ROOM_READ_ONLY_TOOLS,
  ...DATASET_READ_ONLY_TOOLS,
  ...TURN_READ_ONLY_TOOLS,
  ...CAPABILITY_READ_ONLY_TOOLS,
  ...WORKSPACE_READ_ONLY_TOOLS,
];

export const UNTRUSTED_CONTENT_TOOLS: readonly ToolName[] = [
  "get_workspace",
  "get_dashboard",
  "get_run_log",
  "list_feedback",
  ...ROOM_UNTRUSTED_CONTENT_TOOLS,
  ...DATASET_UNTRUSTED_TOOLS,
  ...TURN_UNTRUSTED_CONTENT_TOOLS,
  ...CAPABILITY_UNTRUSTED_TOOLS,
  ...WORKSPACE_UNTRUSTED_TOOLS,
];

export function annotationsFor(name: string, base?: ToolAnnotations): ToolAnnotations {
  const readOnly = base?.readOnlyHint ?? READ_ONLY_TOOLS.includes(name as ToolName);
  const untrusted = base?.untrustedContentHint ?? UNTRUSTED_CONTENT_TOOLS.includes(name as ToolName);
  return { readOnlyHint: readOnly, untrustedContentHint: untrusted };
}
