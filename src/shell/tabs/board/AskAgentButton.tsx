/**
 * Copies a prompt that names the exact tools the agent should call for this
 * card or this chart, then shows "Copied" for two seconds. The human pastes it
 * into the chat next to the page, which is the whole handover.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { copyText } from "../../lib/clipboard";
import "./board.css";

const COPIED_MS = 2000;

export interface AskAgentButtonProps {
  readonly prompt: string;
  readonly label?: string;
  /** Compact variant for a chart header. */
  readonly small?: boolean;
  readonly title?: string;
}

export function AskAgentButton({
  prompt,
  label = "Ask the agent",
  small = false,
  title,
}: AskAgentButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const onClick = useCallback(() => {
    void copyText(prompt).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    });
  }, [prompt]);

  return (
    <button
      type="button"
      className={small ? "mfw-ask mfw-ask--small" : "mfw-ask"}
      onClick={onClick}
      title={title ?? prompt}
      aria-label={label}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
