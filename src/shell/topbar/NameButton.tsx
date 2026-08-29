/**
 * Who you are, in the top bar. Before a name is typed it asks for one instead of
 * showing a placeholder word, and the field it opens is the same one the first run uses.
 */
import { useState, type FormEvent } from "react";
import { MAX_NAME_CHARS } from "../../feedback";
import { NAME_PLACEHOLDER, NAME_UNSET_CHIP } from "../lib/constants";
import { saveMyName, useMyName } from "../lib/name";

const LABEL = "Your name on this board";

export function NameButton(): JSX.Element {
  const me = useMyName();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const start = (): void => {
    setDraft(me.isSet ? me.name : "");
    setEditing(true);
  };

  const commit = (): void => {
    saveMyName(draft);
    setEditing(false);
  };

  const save = (event: FormEvent): void => {
    event.preventDefault();
    commit();
  };

  if (!editing) {
    return (
      <button type="button" className="mfw-fb-name" title={LABEL} aria-label={LABEL} onClick={start}>
        {me.isSet ? me.name : NAME_UNSET_CHIP}
      </button>
    );
  }

  return (
    <form className="mfw-fb-name-form" onSubmit={save}>
      <input
        className="mfw-fb-name-input"
        type="text"
        value={draft}
        maxLength={MAX_NAME_CHARS}
        placeholder={NAME_PLACEHOLDER}
        aria-label={LABEL}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
      />
      <button type="submit" className="mfw-fb-send">
        Save
      </button>
    </form>
  );
}
