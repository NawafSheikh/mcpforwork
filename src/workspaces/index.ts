/**
 * Public surface of the workspaces module.
 *
 * More than one board in one browser: each saved under its own key, listed in a small
 * directory, switched from the panel or by the agent. Import the leaf files from
 * anything that must stay free of React: src/webmcp merges ./tools, src/main.tsx takes
 * the runtime and the directory.
 */

export {
  boardKeyFor,
  coerceDirectory,
  createDirectoryStorage,
  currentEntry,
  defaultEntry,
  entryOf,
  findEntry,
  firstDirectory,
  newWorkspaceId,
  removeEntry,
  uniqueName,
  upsertEntry,
  DIRECTORY_KEY,
} from "./directory";
export type { DirectoryStorage } from "./directory";

export {
  configureWorkspaces,
  createWorkspaces,
  entryLine,
  getWorkspaces,
  resetWorkspaces,
} from "./runtime";
export type { WorkspaceHost, WorkspacesOptions, WorkspacesRuntime } from "./runtime";

export {
  WORKSPACE_READ_ONLY_TOOLS,
  WORKSPACE_TOOL_NAMES,
  WORKSPACE_UNTRUSTED_TOOLS,
  setWorkspaceRoomCheck,
  workspaceJsonSchemas,
  workspaceToolDescriptions,
  workspaceToolHandlers,
  workspaceToolSchemas,
} from "./tools";
export type { WorkspaceToolHandler, WorkspaceToolName } from "./tools";

export {
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_NAME,
  WORKSPACE_LIMITS,
} from "./types";
export type { SaveState, WorkspaceDirectory, WorkspaceEntry, WorkspaceResult } from "./types";

export { useWorkspaces } from "./useWorkspaces";
export type { WorkspacesApi } from "./useWorkspaces";

export { WorkspacesPanel } from "./ui/WorkspacesPanel";
export { savedLabel } from "./ui/savedLabel";
