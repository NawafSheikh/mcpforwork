/**
 * The Workspaces button: which board is open, and whether it is on disk.
 *
 * The label is the answer to "is my work saved", which is the question this page kept
 * getting asked, so it is on the button and not two clicks down. The panel behind it is
 * the whole list.
 */
import { savedLabel, useWorkspaces, WorkspacesPanel } from "../adapters/workspaces";
import { Popover } from "./Popover";

export function WorkspaceMenu(): JSX.Element | null {
  const api = useWorkspaces();
  if (!api.available) return null;
  const state = savedLabel(api.saveState, api.current.savedAt);
  return (
    <Popover
      label={api.entries.length > 1 ? `Workspaces (${api.entries.length})` : "Workspaces"}
      title={`${api.current.name}: ${state}`}
      panelClass="mfw-pop--tools"
    >
      <WorkspacesPanel />
    </Popover>
  );
}
