/**
 * ADAPTER: workspaces (src/workspaces).
 *
 * The shell mounts the panel in a top bar popover and reads the save state for the
 * landing page row. One seam, so nothing else in the shell imports the module directly.
 */
export { WorkspacesPanel, savedLabel, useWorkspaces } from "../../workspaces";
export type { WorkspacesApi } from "../../workspaces";
