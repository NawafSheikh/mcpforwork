/**
 * Tool annotations in one place so definitions.ts and register.ts cannot drift.
 * readOnlyHint marks tools that never change the workspace.
 * untrustedContentHint marks tools that echo text derived from the visitor's own data
 * (category names, dashboard titles, findings), which the agent must not treat as
 * instructions.
 */

import type { ToolAnnotations } from "../types";
import type { ToolName } from "./schemas";

export const READ_ONLY_TOOLS: readonly ToolName[] = [
  "get_workspace",
  "get_dashboard",
  "list_monitors",
  "get_run_log",
];

export const UNTRUSTED_CONTENT_TOOLS: readonly ToolName[] = [
  "get_workspace",
  "get_dashboard",
  "get_run_log",
];

export function annotationsFor(name: string, base?: ToolAnnotations): ToolAnnotations {
  const readOnly = base?.readOnlyHint ?? READ_ONLY_TOOLS.includes(name as ToolName);
  const untrusted = base?.untrustedContentHint ?? UNTRUSTED_CONTENT_TOOLS.includes(name as ToolName);
  return { readOnlyHint: readOnly, untrustedContentHint: untrusted };
}
