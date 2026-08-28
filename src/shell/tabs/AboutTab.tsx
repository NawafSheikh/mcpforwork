/** About: what this is, how it works, and the security model. */
import { SETUP_STEPS } from "../lib/constants";

export function AboutTab(): JSX.Element {
  return (
    <section className="mfw-card mfw-about">
      <h3>About MCP for Work</h3>
      <p>
        MCP for Work turns the work you already have into something an agent can hold. There is no
        data to upload and no connector to configure here. The visitor brings their own ChatGPT,
        which is both the analyst and the local background runner, and this page is the board it
        draws on plus the guardrails it has to respect.
      </p>
      <p>
        ChatGPT pulls your mail, files and tickets through its own connectors, decides on the
        categories, and calls the site tools on this page to build one dashboard per category and
        compose an overview on top. It can register monitors, which are ChatGPT scheduled tasks
        running on your own machine, that report their findings back through the same tools. Every
        proposed action lands in the approval queue, sorted by the policy you wrote.
      </p>
      <p>
        The security model is deliberately small. The tools accept aggregates only, never raw
        records: counts, sums and top lists, so nothing sensitive is retyped into a web page. Writes
        are policy gated, and a policy clause that holds an action is shown by name next to the
        draft it stopped. Every call, from the agent or from you, is written to an audit rail that
        you can filter and read. The agent can propose anything; it can never approve what your
        policy holds, and the approve button stays yours.
      </p>
      <h4>Setting it up in ChatGPT</h4>
      <ol className="mfw-setup">
        {SETUP_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
