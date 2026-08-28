/**
 * The prompt library popover.
 *
 * Prompts are the only thing on this page that a person hands to a model, so they are
 * editable text rather than constants: change the wording, add your own, fill the two
 * variables, copy, paste into ChatGPT. Nothing here is sent anywhere.
 */
import { useState } from "react";
import { usePrompts } from "../usePrompts";
import { PROMPT_LIMITS, type PromptId, type TemplateVars } from "../types";
import { PromptRow } from "./PromptRow";
import "./prompts.css";

const FOOTNOTE = "Prompts run in YOUR ChatGPT, not on this page.";

function NewPromptForm({
  onAdd,
  onCancel,
}: {
  readonly onAdd: (name: string, text: string) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  return (
    <div className="mfw-pl-edit">
      <input
        className="mfw-pl-name-input"
        type="text"
        value={name}
        placeholder="Name it"
        maxLength={PROMPT_LIMITS.nameChars}
        aria-label="New prompt name"
        onChange={(event) => setName(event.target.value)}
      />
      <textarea
        className="mfw-pl-text"
        rows={5}
        value={text}
        placeholder="What should ChatGPT do on this board?"
        maxLength={PROMPT_LIMITS.textChars}
        aria-label="New prompt text"
        onChange={(event) => setText(event.target.value)}
      />
      <div className="mfw-pl-actions">
        <button
          type="button"
          className="mfw-btn mfw-btn-primary"
          disabled={text.trim() === ""}
          onClick={() => onAdd(name, text)}
        >
          Add prompt
        </button>
        <button type="button" className="mfw-btn mfw-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function LibraryBody(): JSX.Element {
  const api = usePrompts();
  const [adding, setAdding] = useState(false);
  const [vars, setVars] = useState<Readonly<Record<PromptId, TemplateVars>>>({});

  return (
    <div className="mfw-pl">
      <h4>Prompt library</h4>
      <ul className="mfw-pl-list">
        {api.state.prompts.map((prompt) => (
          <PromptRow
            key={prompt.id}
            prompt={prompt}
            vars={vars[prompt.id] ?? prompt.vars ?? {}}
            onVars={(next) => setVars((current) => ({ ...current, [prompt.id]: next }))}
            onSave={(name, text) => api.update(prompt.id, { name, text })}
            onReset={() => api.reset(prompt.id)}
            onRemove={() => api.remove(prompt.id)}
          />
        ))}
      </ul>
      {adding ? (
        <NewPromptForm
          onCancel={() => setAdding(false)}
          onAdd={(name, text) => {
            api.add(name, text);
            setAdding(false);
          }}
        />
      ) : (
        <div className="mfw-pl-actions">
          <button
            type="button"
            className="mfw-btn"
            disabled={!api.canAdd}
            onClick={() => setAdding(true)}
          >
            {api.canAdd ? "New prompt" : `Full at ${PROMPT_LIMITS.prompts}`}
          </button>
          <button type="button" className="mfw-btn mfw-btn-ghost" onClick={api.resetAll}>
            Reset all
          </button>
        </div>
      )}
      {api.persisted ? null : (
        <p className="mfw-pl-warn">
          This browser will not save prompts, so these edits last until you close the tab.
        </p>
      )}
      <p className="mfw-share-pop-note">{FOOTNOTE}</p>
    </div>
  );
}

export interface PromptLibraryProps {
  /** Renders the popover already open. Used by the tests and by nothing else. */
  readonly defaultOpen?: boolean;
}

/** Header button plus popover, following the same pattern as the other header pops. */
export function PromptLibrary({ defaultOpen = false }: PromptLibraryProps = {}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <span
      className="mfw-share-wrap"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="mfw-btn"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Prompts
      </button>
      {open ? (
        <div className="mfw-share-pop mfw-pl-pop">
          <LibraryBody />
        </div>
      ) : null}
    </span>
  );
}
