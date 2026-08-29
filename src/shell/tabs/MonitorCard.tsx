/** One monitor: schedule, next run, policy summary, run history, policy editor. */
import { useState } from "react";
import type { Monitor, MonitorRun } from "../../types";
import { describePolicyText } from "../adapters/policy";
import { ClaimBadge } from "../../turns/ui";
import { useWorkspace } from "../context";
import { formatClock, formatRelative } from "../lib/format";
import { PolicyEditor } from "./PolicyEditor";

function RunHistory({ runs }: { readonly runs: readonly MonitorRun[] }): JSX.Element {
  if (runs.length === 0) return <p className="mfw-muted">No runs reported yet.</p>;
  return (
    <ol className="mfw-runs">
      {runs.map((run) => (
        <li className="mfw-run" key={run.id}>
          <span className="mfw-run-when">{formatRelative(run.startedAt)}</span>
          <span className="mfw-run-body">
            {run.findings.map((finding) => (
              <span className="mfw-run-finding" key={finding}>
                {finding}
              </span>
            ))}
            <span className="mfw-muted">{run.draftIds.length} draft(s) from this run</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function MonitorFacts({ monitor }: { readonly monitor: Monitor }): JSX.Element {
  return (
    <dl className="mfw-facts">
      <div>
        <dt>Next run</dt>
        <dd>{formatClock(monitor.nextRunAt)}</dd>
      </div>
      <div>
        <dt>Last run</dt>
        <dd>{monitor.lastRunAt ? formatRelative(monitor.lastRunAt) : "never"}</dd>
      </div>
    </dl>
  );
}

export function MonitorCard({ monitor }: { readonly monitor: Monitor }): JSX.Element {
  const workspace = useWorkspace();
  const [showPolicy, setShowPolicy] = useState(false);

  const runs = [...workspace.runs].filter((run) => run.monitorId === monitor.id).reverse().slice(0, 3);

  return (
    <article className="mfw-card mfw-monitor">
      <header className="mfw-monitor-head">
        <div>
          <h3 className="mfw-monitor-name">{monitor.name}</h3>
          <p className="mfw-muted">
            {monitor.category} | {monitor.schedule} | runs {monitor.runner}
          </p>
        </div>
        <span className="mfw-monitor-flags">
          <ClaimBadge target={{ kind: "monitor", id: monitor.id }} />
          <span className={`mfw-chip mfw-chip-${monitor.status}`}>{monitor.status}</span>
        </span>
      </header>
      <MonitorFacts monitor={monitor} />
      <p className="mfw-policy-summary">{describePolicyText(monitor.policy)}</p>
      {monitor.policy.notes ? <p className="mfw-muted">{monitor.policy.notes}</p> : null}
      <RunHistory runs={runs} />
      <div className="mfw-row-actions">
        <button type="button" className="mfw-btn mfw-btn-ghost" onClick={() => setShowPolicy((open) => !open)}>
          {showPolicy ? "Hide policy" : "Edit policy"}
        </button>
      </div>
      {showPolicy ? <PolicyEditor monitor={monitor} /> : null}
    </article>
  );
}
