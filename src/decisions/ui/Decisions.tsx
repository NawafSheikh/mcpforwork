/**
 * "Why it went that way": the choices agents made, with what they turned down.
 *
 * The one interaction that matters here is disagreeing. A person reading a reason they
 * think is wrong should not have to go and type a note somewhere else about it, and they
 * should not be able to quietly edit the record either. So the button records the
 * objection beside the decision and hands over the sentence to say to the agent, which is
 * the same shape every other "talk to your agent" moment on this page takes.
 */
import { useCallback, useState } from "react";
import { useShell, useWorkspace } from "../../shell/context";
import { copyText } from "../../shell/lib/clipboard";
import { formatRelative } from "../../shell/lib/format";
import { withAudit } from "../../shell/adapters/store";
import { displayName } from "../../feedback";
import type { Decision } from "../../types";
import { disagree, listDecisions } from "../tools";
import "./decisions.css";

export function objectionPrompt(decision: Decision, said: string): string {
  return (
    `On mcpforwork.com, you decided "${decision.what}" and took "${decision.chose}" because ` +
    `${decision.because}. I disagree: ${said}. Read it back with list_decisions, then either ` +
    "change what you did or call decide again saying why you are keeping it."
  );
}

function One({ decision }: { readonly decision: Decision }): JSX.Element {
  const { store } = useShell();
  const [saying, setSaying] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const instead = decision.considered.filter(
    (option) => option.trim().toLowerCase() !== decision.chose.trim().toLowerCase(),
  );

  const send = useCallback(async () => {
    const said = text.trim();
    if (said.length === 0) return;
    setSaying(false);
    setText("");
    await store.update((ws) =>
      withAudit(disagree(ws, decision.id, displayName(), said), {
        actor: "human",
        tool: "disagree",
        args: { decision: decision.id },
        result: `Disagreed with "${decision.what}": ${said}`,
      }),
    );
    const copied = await copyText(objectionPrompt(decision, said));
    setNote(
      copied
        ? "Recorded, and the words to say are on your clipboard."
        : "Recorded. Copy was blocked, so say it in your own words.",
    );
  }, [decision, store, text]);

  return (
    <li className="mfw-dec">
      <p className="mfw-dec__what">{decision.what}</p>
      <p className="mfw-dec__chose">
        <strong>{decision.chose}</strong>
        <span className="mfw-dec__by">
          {decision.by} · {formatRelative(decision.at)}
        </span>
      </p>
      <p className="mfw-dec__because">{decision.because}</p>
      {instead.length === 0 ? null : (
        <p className="mfw-dec__instead">instead of {instead.join(", ")}</p>
      )}

      {decision.disagreed === undefined ? null : (
        <p className="mfw-dec__against">
          {decision.disagreed.by} disagreed: {String(decision.disagreed.said)}
        </p>
      )}

      {saying ? (
        <form
          className="mfw-dec__form"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <input
            className="mfw-input"
            value={text}
            maxLength={200}
            autoFocus
            aria-label="Why this is wrong"
            placeholder="Why this is wrong"
            onChange={(event) => setText(event.target.value)}
          />
          <button type="submit" className="mfw-btn mfw-btn-primary" disabled={text.trim() === ""}>
            Record it
          </button>
        </form>
      ) : decision.disagreed === undefined ? (
        <button type="button" className="mfw-btn mfw-btn-ghost" onClick={() => setSaying(true)}>
          I disagree
        </button>
      ) : null}

      {note === null ? null : (
        <p className="mfw-dec__note" role="status">
          {note}
        </p>
      )}
    </li>
  );
}

export function Decisions(): JSX.Element | null {
  const workspace = useWorkspace();
  const all = listDecisions(workspace);
  if (all.length === 0) return null;

  return (
    <section className="mfw-decs" aria-label="Why it went that way">
      <h2 className="mfw-rail__title">Why it went that way</h2>
      <ul className="mfw-decs__list">
        {all.slice(0, 8).map((decision) => (
          <One decision={decision} key={decision.id} />
        ))}
      </ul>
    </section>
  );
}
