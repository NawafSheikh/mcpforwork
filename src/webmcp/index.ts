/**
 * One import for the shell: build the registry, get the 30 definitions, register them.
 * A3 and A5 pass their own handlers in; anything they have not shipped yet answers
 * "not wired yet" instead of breaking the page.
 */

import type { ToolDefinition, WorkspaceStore } from "../types";
import { workspaceHandlers } from "./handlers";
import { createToolDefinitions } from "./definitions";
import { createToolRegistry, type HandlerMap, type PackGate, type ToolRegistry } from "./registry";

export interface WebmcpBundle {
  readonly registry: ToolRegistry;
  readonly definitions: readonly ToolDefinition[];
}

export interface WebmcpOptions {
  readonly store: WorkspaceStore;
  /** Handlers from other modules, merged over the workspace handlers A2 owns. */
  readonly handlers?: HandlerMap;
  /** Pack switches from src/packs. A tool whose pack is off is refused here too. */
  readonly packs?: PackGate;
  readonly maxCallsPerMinute?: number;
}

export function createWebmcp(options: WebmcpOptions): WebmcpBundle {
  const registry = createToolRegistry({
    store: options.store,
    handlers: { ...workspaceHandlers, ...options.handlers },
    packs: options.packs,
    maxCallsPerMinute: options.maxCallsPerMinute,
  });
  return { registry, definitions: createToolDefinitions(registry) };
}

export { workspaceHandlers } from "./handlers";
export { feedbackHandlers, FEEDBACK_NOTICE, noticeTarget } from "./feedbackTools";
export { createToolDefinitions, TOOL_DESCRIPTIONS } from "./definitions";
export { createToolRegistry, describeIssues } from "./registry";
export type {
  HandlerMap,
  HandlerResult,
  PackGate,
  RegistryOptions,
  ToolCallContext,
  ToolHandler,
  ToolRegistry,
} from "./registry";
export { annotationsFor, READ_ONLY_TOOLS, UNTRUSTED_CONTENT_TOOLS } from "./annotations";
export { findModelContext, registerAllTools } from "./register";
export type {
  ModelContextApi,
  ModelContextLike,
  PackSwitches,
  RegisterOptions,
  RegisterResult,
} from "./register";
export { jsonSchemas } from "./jsonSchemas";
export type { JsonSchema } from "./jsonSchemas";
export { TOOL_NAMES, isToolName, toolSchemas } from "./schemas";
export type { ToolInputs, ToolName } from "./schemas";
