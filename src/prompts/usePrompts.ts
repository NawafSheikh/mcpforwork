/** React binding for the prompt library: state in memory, every change written back. */
import { useCallback, useState } from "react";
import {
  addPrompt,
  canAddPrompt,
  loadPromptState,
  removePrompt,
  resetAllPrompts,
  resetPrompt,
  savePromptState,
  updatePrompt,
  type PromptPatch,
} from "./store";
import type { PromptId, PromptState } from "./types";

export interface PromptsApi {
  readonly state: PromptState;
  /** False once a write was refused, so the popover can say the edit is this tab only. */
  readonly persisted: boolean;
  readonly canAdd: boolean;
  add(name: string, text: string): void;
  update(id: PromptId, patch: PromptPatch): void;
  remove(id: PromptId): void;
  reset(id: PromptId): void;
  resetAll(): void;
}

export function usePrompts(): PromptsApi {
  const [state, setState] = useState<PromptState>(() => loadPromptState());
  const [persisted, setPersisted] = useState(true);

  const commit = useCallback((next: PromptState) => {
    setState(next);
    setPersisted(savePromptState(next));
  }, []);

  return {
    state,
    persisted,
    canAdd: canAddPrompt(state),
    add: useCallback(
      (name: string, text: string) => commit(addPrompt(state, name, text)),
      [commit, state],
    ),
    update: useCallback(
      (id: PromptId, patch: PromptPatch) => commit(updatePrompt(state, id, patch)),
      [commit, state],
    ),
    remove: useCallback((id: PromptId) => commit(removePrompt(state, id)), [commit, state]),
    reset: useCallback((id: PromptId) => commit(resetPrompt(state, id)), [commit, state]),
    resetAll: useCallback(() => commit(resetAllPrompts()), [commit]),
  };
}
