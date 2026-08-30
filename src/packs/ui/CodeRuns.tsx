/**
 * "What just ran": the code an agent executed on its own machine, what it printed, and
 * the picture it drew, if it drew one.
 *
 * This is the half of run_code that makes it worth having. A result the agent alone can
 * read is a tool call; a result a person can read next to the code that produced it is
 * evidence. The code is shown by default and not behind a toggle, because the whole claim
 * is that you can see what ran.
 */
import { useCallback, useSyncExternalStore } from "react";
import { formatRelative } from "../../shell/lib/format";
import { codeRuns, subscribeRuns, type CodeRun } from "../codeRuns";
import "./coderuns.css";

function Run({ run }: { readonly run: CodeRun }): JSX.Element {
  return (
    <li className={`mfw-run ${run.ok ? "" : "mfw-run--failed"}`.trim()}>
      <header className="mfw-run__head">
        <span className="mfw-run__who">{run.caller}</span>
        <span className="mfw-run__what">
          ran {run.runtime}
          {run.why === "" ? "" : `: ${run.why}`}
        </span>
        <span className="mfw-run__when">
          {run.ok ? "" : "failed, "}
          {run.ms} ms · {formatRelative(run.at)}
        </span>
      </header>
      <pre className="mfw-run__code">{run.code}</pre>
      {run.output === "" ? (
        <p className="mfw-run__none">It printed nothing.</p>
      ) : (
        <pre className="mfw-run__out">{run.output}</pre>
      )}
      {run.artifact === null ? null : (
        <img className="mfw-run__art" src={run.artifact} alt={`Drawn by ${run.caller}`} />
      )}
    </li>
  );
}

export function CodeRuns(): JSX.Element | null {
  const subscribe = useCallback((onChange: () => void) => subscribeRuns(onChange), []);
  const runs = useSyncExternalStore(subscribe, codeRuns, codeRuns);
  if (runs.length === 0) return null;

  return (
    <section className="mfw-runs" aria-label="What just ran">
      <header className="mfw-runs__head">
        <h3>What just ran</h3>
        <p className="mfw-runs__line">
          On the machine of whoever ran it. The code and the output are here together, so
          nobody has to take a summary on trust.
        </p>
      </header>
      <ul className="mfw-runs__list">
        {runs.map((run) => (
          <Run key={run.id} run={run} />
        ))}
      </ul>
    </section>
  );
}
