/**
 * The top bar is the room: what this board is, who you are on it, what your agent can
 * reach and how somebody else gets in. Nothing about the work lives up here.
 */
import { NameChip } from "../feedback";
import { getRoomRuntime } from "../rooms";
import { PacksPanel } from "./adapters/packs";
import { useWorkspace } from "./context";
import { AgentPill } from "./topbar/AgentPill";
import { InviteMenu } from "./topbar/InviteMenu";
import { MoreMenu } from "./topbar/MoreMenu";
import { Popover } from "./topbar/Popover";
import { LiveRoomBadge, RoomBadge } from "./topbar/RoomBadge";
import { RoomName } from "./topbar/RoomName";
import { ThemeToggle } from "./topbar/ThemeToggle";

function Wordmark(): JSX.Element {
  return (
    <span className="mfw-brand">
      <span className="mfw-mark" aria-hidden="true">
        MW
      </span>
      <span className="mfw-wordmark">MCP for Work</span>
    </span>
  );
}

export interface TopBarProps {
  /** A shared snapshot: somebody else's board, quoted, with nothing to act on. */
  readonly snapshot?: boolean;
  /** False for a read-only link: the room name stops being editable. */
  readonly editable?: boolean;
}

export function TopBar({ snapshot = false, editable = true }: TopBarProps): JSX.Element {
  const workspace = useWorkspace();
  if (snapshot) {
    return (
      <header className="mfw-top">
        <Wordmark />
        <span className="mfw-roomname">{workspace.name}</span>
        <RoomBadge inRoom={false} fingerprint={null} />
        <span className="mfw-top__spacer" />
        <ThemeToggle />
      </header>
    );
  }
  return (
    <header className="mfw-top">
      <Wordmark />
      <RoomName editable={editable} />
      <LiveRoomBadge />
      <span className="mfw-top__spacer" />
      <AgentPill />
      <InviteMenu />
      <Popover label="Tools" title="What agents may do in this room" panelClass="mfw-pop--tools">
        <PacksPanel />
      </Popover>
      <MoreMenu />
      <NameChip onRename={(name) => getRoomRuntime()?.setLabel(name)} />
      <ThemeToggle />
    </header>
  );
}
