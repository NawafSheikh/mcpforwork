/**
 * The read-only view of a shared snapshot.
 * No tools are registered for a snapshot, no scheduler runs, nothing persists, and the
 * approve path is not on screen: this is somebody else's board, quoted.
 */
import { BoardTab } from "../shell/tabs/BoardTab";
import { SHARE_BANNER } from "../shell/lib/constants";
import { useWorkspace } from "../shell/context";
import "./share.css";

function plural(count: number, one: string, many: string): string {
  return count + " " + (count === 1 ? one : many);
}

function factsLine(
  categories: number,
  monitors: number,
  held: number,
  notes: number,
): string {
  const parts = [plural(categories, "category", "categories"), plural(monitors, "monitor", "monitors")];
  if (held > 0) parts.push(plural(held, "held draft", "held drafts"));
  if (notes > 0) parts.push(plural(notes, "note", "notes"));
  return parts.join(", ");
}

export function SharedBoard(): JSX.Element {
  const ws = useWorkspace();
  const held = Object.values(ws.drafts).filter((draft) => draft.status === "held").length;
  const facts = factsLine(
    Object.keys(ws.categories).length,
    Object.keys(ws.monitors).length,
    held,
    Object.keys(ws.feedback).length,
  );

  return (
    <div className="mfw-shared">
      <p className="mfw-share-banner" role="status">
        {SHARE_BANNER}
      </p>
      <p className="mfw-share-facts">
        {ws.name}: {facts}. Read only, and nothing here is stored on a server.
      </p>
      <BoardTab readOnly />
    </div>
  );
}
