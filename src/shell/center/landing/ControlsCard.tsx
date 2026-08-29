/**
 * "What you control": the five surfaces this page owns, each with its state and one
 * action. It is the answer to "what can I even do here" without a tour or a tooltip.
 */
import { useDatasets } from "../../../dataset";
import { usePacks, PacksPanel } from "../../../packs";
import { usePresence } from "../../../rooms";
import { useWorkspace } from "../../context";
import { CONTROLS_HEADING } from "../../lib/constants";
import { controlRows, type ControlInput, type ControlRow } from "../../lib/controls";
import { roomTitle } from "../../lib/room";
import { useNav } from "../../nav";
import { InviteMenu } from "../../topbar/InviteMenu";
import { Popover } from "../../topbar/Popover";

function useControlInput(): ControlInput {
  const workspace = useWorkspace();
  const presence = usePresence();
  const datasets = useDatasets();
  const { packs } = usePacks();
  const on = packs.filter((view) => view.enabled);
  const count = (views: typeof packs): number =>
    views.reduce((sum, view) => sum + view.pack.tools.length, 0);

  return {
    categories: Object.keys(workspace.categories).length,
    monitors: Object.keys(workspace.monitors).length,
    toolsOn: count(on),
    toolsTotal: count(packs),
    packsOn: on.length,
    packsTotal: packs.length,
    room: presence.slug === null ? null : roomTitle(workspace, presence.slug),
    people: presence.people,
    datasets: datasets.length,
  };
}

function Action({ row }: { readonly row: ControlRow }): JSX.Element {
  const { goTo } = useNav();
  if (row.id === "rooms") return <InviteMenu />;
  if (row.id === "tools") {
    return (
      <Popover label={row.action} title="What agents may do in this room" panelClass="mfw-pop--tools">
        <PacksPanel />
      </Popover>
    );
  }
  const target = row.id === "guardrails" ? "monitors" : row.id === "data" ? "datasets" : "overview";
  return (
    <button type="button" className="mfw-btn" onClick={() => goTo({ kind: target })}>
      {row.action}
    </button>
  );
}

export function ControlsCard(): JSX.Element {
  const rows = controlRows(useControlInput());
  return (
    <section className="mfw-card mfw-first">
      <h2 className="mfw-first__title">{CONTROLS_HEADING}</h2>
      <ul className="mfw-controls">
        {rows.map((row) => (
          <li className="mfw-control" key={row.id}>
            <span className="mfw-control__body">
              <span className="mfw-control__name">{row.label}</span>
              <span className="mfw-control__state">{row.state}</span>
            </span>
            <Action row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}
