/**
 * The next step card: one thing to do next, in plain words, with the prompt ready.
 *
 * It is driven by the state of the board, not by where the visitor clicked, so the same
 * card is right for the person and for their agent. Pure: the caller passes the prompt
 * text in (from src/prompts, so a visitor's own edit of a prompt is what they copy).
 */

export type NextStepId =
  | "name"
  | "connect"
  | "starter"
  | "requests"
  | "drafts"
  | "invite"
  | "steady";

export interface NextStepInput {
  /** False until somebody typed a name on this browser. */
  readonly hasName: boolean;
  /** True when this page is running somewhere an agent can call its tools. */
  readonly connected: boolean;
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
  /** Offered when this board is done: the next piece of work gets its own workspace. */
  readonly nextProject: string;
}

export interface NextStepCard {
  readonly id: NextStepId;
  readonly title: string;
  readonly body: string;
  /** Text to paste into ChatGPT, when there is one. */
  readonly prompt?: string;
  /** The path into the ChatGPT desktop browser, when that is the step. */
  readonly steps?: readonly string[];
  /** Set when the step is answered by a field on the page rather than by a prompt. */
  readonly focus?: string;
}

import { CHATGPT_STEPS, NAME_INPUT_ID } from "./constants";

const CHECK_FEEDBACK =
  "On mcpforwork.com, call list_feedback, do what the open notes ask, then call " +
  "resolve_feedback for each one with a line saying what you did.";

/**
 * Order matters and it is the order of the first hour: say who you are, get an agent
 * onto the page, fill an empty board, answer what was asked of you, decide what is
 * held, then bring somebody else in.
 */
export function nextStep(input: NextStepInput, prompts: NextStepPrompts): NextStepCard {
  if (!input.hasName) {
    return {
      id: "name",
      title: "Tell us your name",
      body: "It signs your notes and your presence in a room, and it stays in this browser.",
      focus: NAME_INPUT_ID,
    };
  }
  if (!input.connected) {
    return {
      id: "connect",
      title: "Open this page inside ChatGPT desktop",
      body: "Nothing here can call a tool until your ChatGPT is on the other end of this page.",
      steps: CHATGPT_STEPS,
    };
  }
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
    title: "Nothing is waiting here",
    body: "Ask for a change, leave a note for the next person or agent that arrives, or open the next piece of work in its own workspace so it does not land on this one.",
    prompt: prompts.nextProject,
  };
}
