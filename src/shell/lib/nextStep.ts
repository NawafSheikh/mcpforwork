/**
 * The next step card: one thing to do next, in plain words, with the prompt ready.
 *
 * It is driven by the state of the board, not by where the visitor clicked, so the same
 * card is right for the person and for their agent. Pure: the caller passes the prompt
 * text in (from src/prompts, so a visitor's own edit of a prompt is what they copy).
 */

export type NextStepId = "starter" | "requests" | "drafts" | "invite" | "steady";

export interface NextStepInput {
  readonly emptyBoard: boolean;
  readonly openRequests: number;
  readonly heldDrafts: number;
  readonly inRoom: boolean;
  /** People in the room, including this browser. */
  readonly people: number;
}

export interface NextStepPrompts {
  readonly starter: string;
  readonly approveAll: string;
}

export interface NextStepCard {
  readonly id: NextStepId;
  readonly title: string;
  readonly body: string;
  /** Text to paste into ChatGPT, when there is one. */
  readonly prompt?: string;
}

const CHECK_FEEDBACK =
  "On mcpforwork.com, call list_feedback, do what the open notes ask, then call " +
  "resolve_feedback for each one with a line saying what you did.";

/**
 * Order matters and it is the order of the work: fill an empty board, answer what was
 * asked of you, decide what is held, then bring somebody else in.
 */
export function nextStep(input: NextStepInput, prompts: NextStepPrompts): NextStepCard {
  if (input.emptyBoard) {
    return {
      id: "starter",
      title: "Start the board",
      body: "Nothing is here yet. Paste this into the chat beside this page and your agent fills it.",
      prompt: prompts.starter,
    };
  }
  if (input.openRequests > 0) {
    return {
      id: "requests",
      title: `${input.openRequests} open ${input.openRequests === 1 ? "request" : "requests"}`,
      body: "Somebody asked for something on this board. Your agent reads them with list_feedback.",
      prompt: CHECK_FEEDBACK,
    };
  }
  if (input.heldDrafts > 0) {
    return {
      id: "drafts",
      title: `${input.heldDrafts} held for a decision`,
      body: "Policy held these, so nothing runs until a person decides. Approve or decline them on Monitors, or hand them to your agent.",
      prompt: prompts.approveAll,
    };
  }
  if (input.inRoom && input.people <= 1) {
    return {
      id: "invite",
      title: "Nobody else is here",
      body: "Send the room link and their board fills in about a second. Their agent joins with them.",
    };
  }
  return {
    id: "steady",
    title: "Nothing is waiting",
    body: "Ask for a change on any card, or leave a note and the next agent that calls picks it up.",
  };
}
