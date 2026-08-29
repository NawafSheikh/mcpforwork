/**
 * The next step card: the one most useful thing to do next, in plain words, with the
 * prompt ready to copy. It follows the state of the board, so the person and the agent
 * are told the same thing at the same time.
 */
import { useCallback } from "react";
import { addressedFeedback } from "../../feedback";
import { getPrompt, STARTER_ID } from "../../prompts";
import { usePresence } from "../../rooms";
import { useWorkspace } from "../context";
import { copyText } from "../lib/clipboard";
import { APPROVE_ALL_PROMPT } from "../lib/constants";
import { nextStep, type NextStepCard } from "../lib/nextStep";
import { boardIsEmpty } from "../lib/room";
import { useToast } from "../Toasts";

/** The visitor's own edit of the shipped prompt, falling back to the shipped text. */
function approveAllPrompt(): string {
  const stored = getPrompt("approve-all");
  return stored.trim().length === 0 ? APPROVE_ALL_PROMPT : stored;
}

export function useNextStep(): NextStepCard {
  const workspace = useWorkspace();
  const presence = usePresence();
  return nextStep(
    {
      emptyBoard: boardIsEmpty(workspace),
      openRequests: addressedFeedback(workspace).length,
      heldDrafts: Object.values(workspace.drafts).filter((draft) => draft.status === "held").length,
      inRoom: presence.slug !== null,
      people: presence.people,
    },
    { starter: getPrompt(STARTER_ID), approveAll: approveAllPrompt() },
  );
}

export function NextStep(): JSX.Element {
  const card = useNextStep();
  const push = useToast();

  const onCopy = useCallback(async () => {
    if (card.prompt === undefined) return;
    const ok = await copyText(card.prompt);
    push(ok ? "Prompt copied. Paste it into ChatGPT." : "Copy blocked by the browser.", ok ? "ok" : "warn");
  }, [card.prompt, push]);

  return (
    <section className="mfw-rail__block mfw-next" aria-label="Next step">
      <h2 className="mfw-rail__title">Next step</h2>
      <p className="mfw-next__title">{card.title}</p>
      <p className="mfw-next__body">{card.body}</p>
      {card.prompt === undefined ? null : (
        <>
          <code className="mfw-next__prompt">{card.prompt}</code>
          <button type="button" className="mfw-btn mfw-btn-primary" onClick={() => void onCopy()}>
            Copy the prompt
          </button>
        </>
      )}
    </section>
  );
}
