/**
 * The shipped prompts, seeded from src/shell/lib/constants.ts.
 *
 * The only difference from the constants is that the numbers and the category name are
 * lifted into {{threads}} and {{category}}, with the original values kept as the
 * defaults. Rendering a seed with its own defaults gives back the constant character
 * for character, which src/prompts/__tests__/prompts.test.ts checks on every run.
 */
import {
  APPROVE_ALL_PROMPT,
  MONITOR_PROMPT,
  NEXT_PROJECT_PROMPT,
  PROJECTS_PROMPT,
  QUICK_PROMPT,
  STARTER_PROMPT,
} from "../shell/lib/constants";
import { PROMPTS_VERSION, type PromptRecord, type PromptState } from "./types";

export const STARTER_ID = "starter";
export const QUICK_ID = "quick";
export const MONITOR_ID = "monitor";
export const APPROVE_ALL_ID = "approve-all";
export const PROJECTS_ID = "projects";
export const NEXT_PROJECT_ID = "next-project";

const SEEDS: readonly PromptRecord[] = [
  {
    id: STARTER_ID,
    name: "Starter prompt",
    text: STARTER_PROMPT.replace("last 30 Gmail threads", "last {{threads}} Gmail threads"),
    builtIn: true,
    vars: { threads: 30 },
  },
  {
    id: QUICK_ID,
    name: "Quick demo prompt",
    text: QUICK_PROMPT.replace("last 15 Gmail threads", "last {{threads}} Gmail threads"),
    builtIn: true,
    vars: { threads: 15 },
  },
  {
    id: MONITOR_ID,
    name: "Register a monitor",
    text: MONITOR_PROMPT.replace("on the Invoices category", "on the {{category}} category"),
    builtIn: true,
    vars: { category: "Invoices" },
  },
  {
    id: PROJECTS_ID,
    name: "A workspace per project (the big one)",
    text: PROJECTS_PROMPT.replace("last 40 Gmail threads", "last {{threads}} Gmail threads"),
    builtIn: true,
    vars: { threads: 40 },
  },
  {
    id: NEXT_PROJECT_ID,
    name: "Start the next workspace",
    text: NEXT_PROJECT_PROMPT,
    builtIn: true,
  },
  {
    id: APPROVE_ALL_ID,
    name: "Approve everything (tests the guardrails)",
    text: APPROVE_ALL_PROMPT,
    builtIn: true,
  },
];

/** A fresh copy every call, so nothing downstream can edit the seeds in place. */
export function defaultPrompts(): readonly PromptRecord[] {
  return SEEDS.map((prompt) => ({ ...prompt, ...(prompt.vars ? { vars: { ...prompt.vars } } : {}) }));
}

export function defaultPromptState(): PromptState {
  return { v: PROMPTS_VERSION, prompts: defaultPrompts() };
}

export function defaultPrompt(id: string): PromptRecord | undefined {
  const found = SEEDS.find((prompt) => prompt.id === id);
  return found ? { ...found, ...(found.vars ? { vars: { ...found.vars } } : {}) } : undefined;
}
