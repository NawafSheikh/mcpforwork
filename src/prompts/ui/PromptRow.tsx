/** One prompt in the library: read it, fill it, copy it, or edit it in place. */
import { useEffect, useRef, useState } from "react";
import { copyText } from "../../shell/lib/clipboard";
import { firstLine, renderTemplate, usedVars } from "../template";
import { PROMPT_LIMITS, type PromptRecord, type TemplateVars } from "../types";
import { VarsPicker } from "./VarsPicker";

const COPIED_MS = 2000;

export interface PromptRowProps {
  readonly prompt: PromptRecord;
  readonly vars: TemplateVars;
  readonly onVars: (next: TemplateVars) => void;
  readonly onSave: (name: string, text: string) => void;
  readonly onReset: () => void;
  readonly onRemove: () => void;
}

function EditForm({
  prompt,
  onSave,
  onCancel,
}: {
  readonly prompt: PromptRecord;
  readonly onSave: (name: string, text: string) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const [name, setName] = useState(prompt.name);
  const [text, setText] = useState(prompt.text);
  return (
    <div className="mfw-pl-edit">
      <input
        className="mfw-pl-name-input"
        type="text"
        value={name}
        maxLength={PROMPT_LIMITS.nameChars}
        aria-label="Prompt name"
        onChange={(event) => setName(event.target.value)}
      />
      <textarea
        className="mfw-pl-text"
        rows={6}
        value={text}
        maxLength={PROMPT_LIMITS.textChars}
        aria-label="Prompt text"
        onChange={(event) => setText(event.target.value)}
      />
      <p className="mfw-pl-hint">
        {`${text.length} of ${PROMPT_LIMITS.textChars} characters. Use {{threads}} and {{category}} to fill values when you copy.`}
      </p>
      <div className="mfw-pl-actions">
        <button
          type="button"
          className="mfw-btn mfw-btn-primary"
          disabled={text.trim() === ""}
          onClick={() => onSave(name, text)}
        >
          Save
        </button>
        <button type="button" className="mfw-btn mfw-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PromptRow({
  prompt,
  vars,
  onVars,
  onSave,
  onReset,
  onRemove,
}: PromptRowProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const onCopy = async (): Promise<void> => {
    const ok = await copyText(renderTemplate(prompt.text, vars));
    if (!ok) return;
    setCopied(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <li className="mfw-pl-item">
      <div className="mfw-pl-head">
        <span className="mfw-pl-name">{prompt.name}</span>
        <button type="button" className="mfw-btn mfw-pl-copy" onClick={() => void onCopy()}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mfw-pl-line">{firstLine(prompt.text)}</p>
      <VarsPicker
        idBase={`prompt-${prompt.id}`}
        used={usedVars(prompt.text)}
        vars={vars}
        onChange={onVars}
      />
      {editing ? (
        <EditForm
          prompt={prompt}
          onCancel={() => setEditing(false)}
          onSave={(name, text) => {
            onSave(name, text);
            setEditing(false);
          }}
        />
      ) : (
        <div className="mfw-pl-actions">
          <button type="button" className="mfw-btn mfw-btn-ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
          {prompt.builtIn ? (
            <button type="button" className="mfw-btn mfw-btn-ghost" onClick={onReset}>
              Reset
            </button>
          ) : (
            <button type="button" className="mfw-btn mfw-btn-ghost" onClick={onRemove}>
              Delete
            </button>
          )}
        </div>
      )}
    </li>
  );
}
