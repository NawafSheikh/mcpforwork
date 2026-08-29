/**
 * The visitor's display name as a React value: every component that reads it re-renders
 * when any one of them saves a new one. The chip that edits it lives in the shell, so
 * this file stays free of markup.
 */
import { useCallback, useSyncExternalStore } from "react";

import { displayName, subscribeName } from "../identity";

export function useDisplayName(): string {
  const subscribe = useCallback((onChange: () => void) => subscribeName(onChange), []);
  return useSyncExternalStore(subscribe, displayName, displayName);
}
