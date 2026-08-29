/**
 * The board's own actions, kept out of the room's buttons: a snapshot link, the prompt
 * library, the backup file and the way into the ChatGPT browser.
 * Nothing here is the only route to a feature; each one has a home in the columns too.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Backup, PromptLibrary } from "../../prompts";
import { buildShareUrl } from "../../share";
import { useWorkspace } from "../context";
import { copyText } from "../lib/clipboard";
import { CHATGPT_STEPS, CHATGPT_STEPS_NOTE } from "../lib/constants";
import { Popover } from "./Popover";

const COPIED_MS = 2000;

function ShareButton(): JSX.Element {
  const workspace = useWorkspace();
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const onShare = useCallback(async () => {
    if (timer.current !== null) clearTimeout(timer.current);
    try {
      const copied = await copyText(await buildShareUrl(workspace));
      setNote(copied ? "Read-only link copied" : "Copy blocked by the browser");
      if (copied) timer.current = setTimeout(() => setNote(null), COPIED_MS);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Share failed");
    }
  }, [workspace]);

  return (
    <>
      <button type="button" className="mfw-btn" onClick={() => void onShare()}>
        Share a snapshot
      </button>
      {note === null ? null : (
        <span className="mfw-muted" role="status">
          {note}
        </span>
      )}
    </>
  );
}

export function MoreMenu(): JSX.Element {
  return (
    <Popover label="Board" title="Snapshot, prompts and backup" panelClass="mfw-pop--more">
      <h4>This board</h4>
      <div className="mfw-pop__actions">
        <ShareButton />
        <PromptLibrary />
        <Backup />
      </div>
      <h4>Opening this page in ChatGPT desktop</h4>
      <ol className="mfw-setup">
        {CHATGPT_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mfw-pop__note">{CHATGPT_STEPS_NOTE}</p>
    </Popover>
  );
}
