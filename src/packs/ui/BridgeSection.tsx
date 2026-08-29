/**
 * The Local bridge section of the Tools panel.
 *
 * Off until a person switches it on. When it is on, every pack the bridge serves is a
 * pack on this page with its own switch, and a robot pack shows the profile: what it is,
 * what it can do, and that it can be stopped inside a boundary.
 */
import { verdictText } from "../bridgeIdentity";
import type { BridgePackView } from "../bridgeSession";
import type { RobotProfile } from "../bridge";
import { useBridge } from "../useBridge";
import "./packs.css";

const STATUS_TEXT: Readonly<Record<string, string>> = {
  off: "Off. Nothing on your machine is reachable from this page.",
  connecting: "Connecting to 127.0.0.1 ...",
  on: "Connected. These tools run on your machine, not on this site.",
  error: "Could not connect.",
};

function RobotCard({ robot }: { readonly robot: RobotProfile }): JSX.Element {
  return (
    <div className="mfw-robot">
      <div className="mfw-robot-head">
        <strong>{robot.name}</strong>
        <span className="mfw-chip">{robot.kind}</span>
        <span className="mfw-chip">{robot.owner}</span>
      </div>
      <div className="mfw-robot-line">Can: {robot.capabilities.join(", ") || "nothing declared"}</div>
      <div className="mfw-robot-line">Sees: {robot.sensors.join(", ") || "nothing declared"}</div>
      <div className="mfw-robot-line">
        Moves at most {robot.limits.maxMoveCm} cm, keeps {robot.limits.minClearanceCm} cm clear.
      </div>
      <div className="mfw-robot-line mfw-robot-safety">
        {robot.safety.stop ? "Can be stopped" : "No stop declared"} ·{" "}
        {robot.safety.boundary ? "stays inside a boundary" : "no boundary declared"}
      </div>
    </div>
  );
}

function BridgePackRow({
  pack,
  onToggle,
}: {
  readonly pack: BridgePackView;
  readonly onToggle: (id: string, enabled: boolean) => void;
}): JSX.Element {
  return (
    <li className="mfw-pack">
      <label className="mfw-pack-switch">
        <input
          checked={pack.enabled}
          onChange={(event) => onToggle(pack.id, event.target.checked)}
          type="checkbox"
        />
        <span className="mfw-pack-name">{pack.name}</span>
      </label>
      <span className="mfw-chip">{pack.risk}</span>
      <span className="mfw-pack-count">{pack.tools} tools</span>
      <p className="mfw-pack-desc">{pack.description}</p>
      {pack.robot === undefined ? null : <RobotCard robot={pack.robot} />}
    </li>
  );
}

export function BridgeSection(): JSX.Element {
  const bridge = useBridge();
  const on = bridge.status === "on";
  return (
    <section className="mfw-packs-section">
      <header className="mfw-packs-head">
        <h3>Local bridge</h3>
        <button
          className="mfw-btn"
          onClick={on ? bridge.disconnect : bridge.connect}
          type="button"
        >
          {on ? "Disconnect" : "Connect"}
        </button>
      </header>
      <p className="mfw-pack-desc">{STATUS_TEXT[bridge.status] ?? ""}</p>
      {bridge.error === "" ? null : <p className="mfw-packs-warn">{bridge.error}</p>}
      {on && bridge.fingerprint !== "" ? (
        <p className="mfw-pack-desc">{verdictText(bridge.verdict, bridge.fingerprint)}</p>
      ) : null}
      {bridge.refused.map((reason) => (
        <p className="mfw-packs-warn" key={reason}>
          Refused {reason}
        </p>
      ))}
      <ul className="mfw-packs-list">
        {bridge.packs.map((pack) => (
          <BridgePackRow key={pack.id} onToggle={bridge.setPack} pack={pack} />
        ))}
      </ul>
    </section>
  );
}
