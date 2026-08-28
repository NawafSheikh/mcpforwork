/**
 * Prompt storage. The library lives in localStorage under "mfw:prompts", versioned,
 * and every read and write is wrapped: a private window, a full quota or a hand edited
 * value falls back to the shipped prompts rather than breaking the page.
 *
 * Everything here is pure except load and save. State goes in, new state comes out.
 */
import { defaultPromptState, defaultPrompt, defaultPrompts } from "./defaults";
import { renderTemplate } from "./template";
import {
  PROMPTS_KEY,
  PROMPTS_VERSION,
  PROMPT_LIMITS,
  type PromptId,
  type PromptRecord,
  type PromptState,
  type TemplateVars,
} from "./types";

export interface PromptStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** localStorage when the browser has one it will let us touch, otherwise nothing. */
export function browserStorage(): PromptStorage | null {
  try {
    const store = (globalThis as { localStorage?: PromptStorage }).localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

function cut(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function coerceVars(raw: unknown): TemplateVars | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as { threads?: unknown; category?: unknown };
  const threads =
    typeof record.threads === "number" && Number.isFinite(record.threads)
      ? Math.trunc(record.threads)
      : undefined;
  const category =
    typeof record.category === "string" ? cut(record.category.trim(), PROMPT_LIMITS.nameChars) : undefined;
  if (threads === undefined && (category === undefined || category === "")) return undefined;
  return {
    ...(threads !== undefined ? { threads } : {}),
    ...(category !== undefined && category !== "" ? { category } : {}),
  };
}

function coercePrompt(raw: unknown): PromptRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const text = typeof record.text === "string" ? record.text : "";
  if (id === "" || id.length > PROMPT_LIMITS.nameChars) return null;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const vars = coerceVars(record.vars);
  return {
    id,
    name: cut(name === "" ? id : name, PROMPT_LIMITS.nameChars),
    text: cut(text, PROMPT_LIMITS.textChars),
    builtIn: defaultPrompt(id) !== undefined,
    ...(vars ? { vars } : {}),
  };
}

/** Seeded prompts are never lost: whatever is missing is put back at the top. */
function withSeeds(prompts: readonly PromptRecord[]): readonly PromptRecord[] {
  const missing = defaultPrompts().filter(
    (seed) => !prompts.some((prompt) => prompt.id === seed.id),
  );
  return [...missing, ...prompts].slice(0, PROMPT_LIMITS.prompts);
}

function coerceState(raw: unknown): PromptState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as { v?: unknown; prompts?: unknown };
  if (record.v !== PROMPTS_VERSION || !Array.isArray(record.prompts)) return null;
  const seen = new Set<string>();
  const prompts: PromptRecord[] = [];
  for (const item of record.prompts) {
    const prompt = coercePrompt(item);
    if (prompt === null || seen.has(prompt.id)) continue;
    seen.add(prompt.id);
    prompts.push(prompt);
    if (prompts.length >= PROMPT_LIMITS.prompts) break;
  }
  return { v: PROMPTS_VERSION, prompts: withSeeds(prompts) };
}

/** The saved library, or the shipped one. Never throws, never returns empty. */
export function loadPromptState(storage: PromptStorage | null = browserStorage()): PromptState {
  if (storage === null) return defaultPromptState();
  try {
    const raw = storage.getItem(PROMPTS_KEY);
    if (raw === null) return defaultPromptState();
    return coerceState(JSON.parse(raw)) ?? defaultPromptState();
  } catch {
    return defaultPromptState();
  }
}

/** False when the browser refused the write, so the UI can say so instead of lying. */
export function savePromptState(
  state: PromptState,
  storage: PromptStorage | null = browserStorage(),
): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(PROMPTS_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function findPrompt(state: PromptState, id: PromptId): PromptRecord | undefined {
  return state.prompts.find((prompt) => prompt.id === id);
}

export function canAddPrompt(state: PromptState): boolean {
  return state.prompts.length < PROMPT_LIMITS.prompts;
}

let sequence = 0;

function newId(): string {
  sequence += 1;
  return `p_${Date.now().toString(36)}_${sequence.toString(36)}`;
}

/** Add one prompt. At the cap the state comes back unchanged: canAddPrompt says why. */
export function addPrompt(state: PromptState, name: string, text: string): PromptState {
  if (!canAddPrompt(state)) return state;
  const prompt: PromptRecord = {
    id: newId(),
    name: cut(name.trim() === "" ? "Untitled prompt" : name.trim(), PROMPT_LIMITS.nameChars),
    text: cut(text, PROMPT_LIMITS.textChars),
    builtIn: false,
  };
  return { ...state, prompts: [...state.prompts, prompt] };
}

export interface PromptPatch {
  readonly name?: string;
  readonly text?: string;
  readonly vars?: TemplateVars;
}

export function updatePrompt(state: PromptState, id: PromptId, patch: PromptPatch): PromptState {
  return {
    ...state,
    prompts: state.prompts.map((prompt) =>
      prompt.id === id
        ? {
            ...prompt,
            ...(patch.name !== undefined
              ? { name: cut(patch.name.trim() || prompt.name, PROMPT_LIMITS.nameChars) }
              : {}),
            ...(patch.text !== undefined ? { text: cut(patch.text, PROMPT_LIMITS.textChars) } : {}),
            ...(patch.vars !== undefined ? { vars: patch.vars } : {}),
          }
        : prompt,
    ),
  };
}

/** Seeded prompts stay: reset puts the wording back, delete is for your own prompts. */
export function removePrompt(state: PromptState, id: PromptId): PromptState {
  const prompt = findPrompt(state, id);
  if (prompt === undefined || prompt.builtIn) return state;
  return { ...state, prompts: state.prompts.filter((item) => item.id !== id) };
}

export function resetPrompt(state: PromptState, id: PromptId): PromptState {
  const seed = defaultPrompt(id);
  if (seed === undefined) return state;
  return { ...state, prompts: state.prompts.map((item) => (item.id === id ? seed : item)) };
}

export function resetAllPrompts(): PromptState {
  return defaultPromptState();
}

/**
 * One prompt as text, ready to paste. Callers that only want the starter prompt can
 * use this instead of the constant, and they get the user's edits for free.
 */
export function getPrompt(id: PromptId, vars?: TemplateVars): string {
  const state = loadPromptState();
  const prompt = findPrompt(state, id) ?? defaultPrompt(id);
  if (prompt === undefined) return "";
  return renderTemplate(prompt.text, { ...prompt.vars, ...vars });
}
