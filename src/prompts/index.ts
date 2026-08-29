/**
 * Public surface of the prompt library.
 *
 * Callers that only want text to paste should use getPrompt("starter"), which returns
 * the user's own edit of the shipped prompt rather than a frozen constant.
 */

export { PromptLibrary } from "./ui/PromptLibrary";
export type { PromptLibraryProps } from "./ui/PromptLibrary";
export { Backup } from "./ui/Backup";
export type { BackupProps } from "./ui/Backup";
export { usePrompts } from "./usePrompts";
export type { PromptsApi } from "./usePrompts";
export { renderTemplate, usedVars, firstLine, TEMPLATE_VAR_NAMES } from "./template";
export type { TemplateVarName } from "./template";
export {
  addPrompt,
  browserStorage,
  canAddPrompt,
  findPrompt,
  getPrompt,
  loadPromptState,
  removePrompt,
  resetAllPrompts,
  resetPrompt,
  savePromptState,
  updatePrompt,
} from "./store";
export type { PromptPatch, PromptStorage } from "./store";
export {
  defaultPrompt,
  defaultPromptState,
  defaultPrompts,
  APPROVE_ALL_ID,
  MONITOR_ID,
  NEXT_PROJECT_ID,
  PROJECTS_ID,
  QUICK_ID,
  STARTER_ID,
} from "./defaults";
export { PROMPTS_KEY, PROMPTS_VERSION, PROMPT_LIMITS } from "./types";
export type { PromptId, PromptRecord, PromptState, TemplateVars } from "./types";
export {
  BACKUP_TOOL,
  backupFileName,
  backupJson,
  categoryCount,
  downloadJson,
  restoreFrom,
} from "./ui/backupFile";
