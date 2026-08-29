/** About: what this is, how it works, what it refuses to do, and how to open it. */
import { chooseTransport } from "../../rooms";
import { CHATGPT_STEPS, CHATGPT_STEPS_NOTE } from "../lib/constants";

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
        The security model is deliberately small. The tools accept summaries with real names, amounts and dates, never full message bodies or
        records: counts, sums and top lists, so nothing sensitive is retyped into a web page. In a
        real run on 28 August 2026 ChatGPT stopped before writing and asked first, in its own
        words: it would not send your email address, sender names, subjects, URLs, IDs, snippets or
        message bodies. Writes are policy gated, and a policy clause that holds an action is shown
        by name next to the draft it stopped. Every call, from the agent or from you, is written to
        an audit rail that you can filter and read. The agent can propose anything; it can never
        approve what your policy holds, and the approve button stays yours.
      </p>
      <h4>Working in turns with the agent</h4>
      <p>
        A dashboard is not finished when the agent stops. Leave a note on any dashboard, the
        overview or a draft, and it stays open until an agent reads it back with list_feedback,
        acts on it and resolves it with a resolution line. Every tool call can carry a caller
        label, so when ChatGPT splits the work between sub-agents the rail shows which one wrote
        what. Whoever writes to an object gets their name on its card for ten minutes, and nobody
        is ever blocked by that badge: a second agent writing the same dashboard keeps what the
        first one added, and only a write that would delete the very chart somebody just changed
        comes back asking to be read again. Press Share to put a read-only copy of the whole board
        in a link: the state travels in the URL fragment, which browsers never send to a server,
        so a snapshot needs no account and no backend.
      </p>
      <h4>Sharing a board as a room</h4>
      <p>
        Press Invite to room and this board gets a short slug in the address bar and a key after
        the #. Everyone who opens that whole link works on the same board, and each change shows up
        on the other side in about a second. The room is encrypted end to end: the key is minted
        here, never leaves the fragment, and the relay carries sealed envelopes it cannot read.
        There is no setting and no passphrase, but the link is the whole access control, so anyone
        holding it can read and write, and a link with the # part trimmed off cannot open the room
        at all. The audit rail is shared on purpose, so the people in a room see one trail. Drop a
        CSV or XLSX on the board and the file is parsed here instead: the rows sit in memory until
        the tab closes, and the agent only ever sees the column profile and the aggregates it asks
        for.
      </p>
      <p className="mfw-muted">{chooseTransport().note}</p>

      <h4>Opening this page in ChatGPT desktop</h4>
      <ol className="mfw-setup">
        {CHATGPT_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mfw-muted">{CHATGPT_STEPS_NOTE}</p>
    </section>
  );
}
