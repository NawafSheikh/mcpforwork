/**
 * The first thing on an empty board: who are you.
 *
 * It writes the same value the top bar chip and the members rail read, so typing here
 * changes both in the same tick. Nothing else on the page waits for it.
 */
import { useState, type FormEvent } from "react";
import { MAX_NAME_CHARS } from "../../../feedback";
import { NAME_INPUT_ID, NAME_PLACEHOLDER, NAME_QUESTION } from "../../lib/constants";
import { saveMyName, useMyName } from "../../lib/name";

export function NameCard(): JSX.Element {
  const me = useMyName();
  const [draft, setDraft] = useState("");

  const commit = (): void => {
    const saved = saveMyName(draft);
    if (saved !== null) setDraft("");
  };

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    commit();
  };

  return (
    <section className="mfw-card mfw-first">
      <h2 className="mfw-first__title">{NAME_QUESTION}</h2>
      <form className="mfw-first__nameform" onSubmit={onSubmit}>
        <input
          id={NAME_INPUT_ID}
          className="mfw-first__nameinput"
          type="text"
          value={draft}
          maxLength={MAX_NAME_CHARS}
          placeholder={NAME_PLACEHOLDER}
          aria-label={NAME_QUESTION}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
        />
        <button type="submit" className="mfw-btn mfw-btn-primary">
          Save
        </button>
      </form>
      <p className="mfw-muted mfw-first__note">
        {me.isSet
          ? `Your notes and your presence in a room are signed ${me.name}.`
          : "It signs your notes and your presence in a room. It stays in this browser."}
      </p>
    </section>
  );
}
