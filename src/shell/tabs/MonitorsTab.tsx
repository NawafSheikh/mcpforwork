/** Monitors: what runs on a schedule, under what policy, waiting on which decision. */
import { useWorkspace } from "../context";
import { STARTER_PROMPT } from "../lib/constants";
import { DraftQueue } from "./DraftQueue";
import { MonitorCard } from "./MonitorCard";

export function MonitorsTab(): JSX.Element {
  const workspace = useWorkspace();
  const monitors = Object.values(workspace.monitors);

  return (
    <div className="mfw-monitors">
      <section className="mfw-card mfw-monitors-intro">
        <h3>Monitors</h3>
        <p className="mfw-muted">
          A monitor is a ChatGPT scheduled task that runs on your machine and reports back here
          through the site tools. This page never reaches into your accounts on its own.
        </p>
        {monitors.length === 0 ? (
          <p className="mfw-muted">
            None registered. Build a dashboard first, then ask ChatGPT to watch it. Starter prompt:
            {` "${STARTER_PROMPT}"`}
          </p>
        ) : null}
      </section>
      {monitors.map((monitor) => (
        <MonitorCard monitor={monitor} key={monitor.id} />
      ))}
      <DraftQueue />
    </div>
  );
}
