/** Shapes for the prompt library. Prompts are text a person pastes into ChatGPT. */

export type PromptId = string;

/** The two variables a prompt can carry. Anything else in braces is left alone. */
export interface TemplateVars {
  readonly threads?: number;
  readonly category?: string;
}

export interface PromptRecord {
  readonly id: PromptId;
  readonly name: string;
  readonly text: string;
  /** Seeded prompts can be reset to their shipped wording but never deleted. */
  readonly builtIn: boolean;
  /** Values the copy picker starts from, so a seeded prompt copies as it reads. */
  readonly vars?: TemplateVars;
}

export interface PromptState {
  readonly v: number;
  readonly prompts: readonly PromptRecord[];
}

export const PROMPT_LIMITS = {
  prompts: 20,
  textChars: 1000,
  nameChars: 60,
} as const;

export const PROMPTS_KEY = "mfw:prompts";
export const PROMPTS_VERSION = 1;
