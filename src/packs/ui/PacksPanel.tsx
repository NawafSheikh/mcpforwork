/**
 * The Tools panel: what agents may do here, decided on the page (docs/PACKS.md).
 *
 * One row per pack with a switch, the risk it carries, how many tools it is, and who
 * last moved it. Outside a room the person decides; inside a room the switches are
 * disabled for everybody but the host, with the reason said in plain words rather than
 * hidden. Below: the local bridge, and the catalog of work packs that are still coming.
 */
import { catalogStatusText, WORK_PACKS } from "../catalog";
import { packRiskLabel } from "../registry";
import { changedByText, type PackView } from "../state";
import { listChoices } from "../../purpose/tools";
import { useWorkspace } from "../../shell/context";
import { usePacks } from "../usePacks";
import { BridgeSection } from "./BridgeSection";
import "./packs.css";

function PackRow({
  view,
  disabled,
  onToggle,
  reason,
}: {
  readonly view: PackView;
  readonly disabled: boolean;
  readonly onToggle: (id: string, enabled: boolean) => void;
  /** Why an agent asked for this pack, in its own words, when it did. */
  readonly reason?: { readonly why: string; readonly by: string; readonly proposed?: boolean };
}): JSX.Element {
  const who = changedByText(view);
  return (
    <li className="mfw-pack">
      <label className="mfw-pack-switch">
        <input
          checked={view.enabled}
          disabled={disabled}
          onChange={(event) => onToggle(view.pack.id, event.target.checked)}
          type="checkbox"
        />
        <span className="mfw-pack-name">{view.pack.name}</span>
      </label>
      <span className={`mfw-chip mfw-chip-risk-${view.pack.risk}`}>{packRiskLabel(view.pack)}</span>
      <span className="mfw-pack-count">{view.pack.tools.length} tools</span>
      <p className="mfw-pack-desc">{view.pack.description}</p>
      {who === "" ? null : <p className="mfw-pack-who">{who}</p>}
      {reason === undefined ? null : (
        <p className={`mfw-pack-why ${reason.proposed ? "mfw-pack-why--waiting" : ""}`.trim()}>
          {reason.proposed ? `${reason.by} asked for this and it is waiting for you: ` : `${reason.by}: `}
          {reason.why}
        </p>
      )}
    </li>
  );
}

function CatalogSection(): JSX.Element {
  return (
    <section className="mfw-packs-section">
      <header className="mfw-packs-head">
        <h3>Work packs</h3>
      </header>
      <p className="mfw-pack-desc">
        These arrive through the local bridge, on the machine that has the access. Nothing here
        is on the site.
      </p>
      <ul className="mfw-packs-list">
        {WORK_PACKS.map((entry) => (
          <li className="mfw-pack" key={entry.id}>
            <span className="mfw-pack-name">{entry.name}</span>
            <span className="mfw-chip">{entry.risk}</span>
            <span className="mfw-pack-count">{catalogStatusText(entry.status)}</span>
            <p className="mfw-pack-desc">{entry.line}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PacksPanel(): JSX.Element {
  const { packs, maySwitch, reason, setPack } = usePacks();
  const workspace = useWorkspace();
  // What an agent said when it argued for a pack, keyed by pack id.
  const reasons = Object.fromEntries(
    listChoices(workspace).map((item) => [
      item.pack,
      { why: item.why, by: item.by, ...(item.proposed === true ? { proposed: true } : {}) },
    ]),
  );
  const total = packs.reduce((sum, view) => (view.enabled ? sum + view.pack.tools.length : sum), 0);
  return (
    <div className="mfw-packs">
      {workspace.purpose === undefined ? null : (
        <p className="mfw-packs-purpose">
          <strong>This workspace is for:</strong> {workspace.purpose}
        </p>
      )}
      <section className="mfw-packs-section">
        <header className="mfw-packs-head">
          <h3>Tools</h3>
          <span className="mfw-pack-count">{total} on</span>
        </header>
        <p className="mfw-pack-desc">
          What an agent may do on this board. Switching a pack off takes its tools off the page
          at once.
        </p>
        {reason === "" ? null : <p className="mfw-packs-warn">{reason}</p>}
        <ul className="mfw-packs-list">
          {packs.map((view) => (
            <PackRow
              disabled={!maySwitch}
              key={view.pack.id}
              onToggle={setPack}
              view={view}
              {...(reasons[view.pack.id] === undefined ? {} : { reason: reasons[view.pack.id] })}
            />
          ))}
        </ul>
      </section>
      <BridgeSection />
      <CatalogSection />
    </div>
  );
}
