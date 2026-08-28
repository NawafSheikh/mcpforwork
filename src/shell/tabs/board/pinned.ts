/**
 * Pinned categories: a human preference, not workspace state, so it lives in
 * localStorage keyed by workspace id and never reaches the agent or the store.
 * Every read and write is wrapped: a browser with storage blocked still works,
 * it just forgets the pins. Lists are replaced, never mutated.
 */

import { useCallback, useEffect, useState } from "react";

const PREFIX = "mfw:pinned:";

export function pinnedKey(workspaceId: string): string {
  return `${PREFIX}${workspaceId}`;
}

/** Stored pins, or an empty list when storage is unavailable or corrupt. */
export function readPinned(workspaceId: string): readonly string[] {
  try {
    const raw = globalThis.localStorage?.getItem(pinnedKey(workspaceId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

/** Best effort write. A failure is not worth interrupting the board for. */
export function writePinned(workspaceId: string, names: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(pinnedKey(workspaceId), JSON.stringify([...names]));
  } catch {
    /* storage disabled: pins are a convenience, the board keeps working */
  }
}

/** Add or remove one name, always returning a new list. */
export function togglePinned(list: readonly string[], name: string): readonly string[] {
  return list.includes(name) ? list.filter((entry) => entry !== name) : [...list, name];
}

/** Pinned entries first (in pin order), then the rest in their given order. */
export function sortPinnedFirst<T extends { readonly name: string }>(
  items: readonly T[],
  pinned: readonly string[],
): readonly T[] {
  const rank = (item: T): number => {
    const at = pinned.indexOf(item.name);
    return at === -1 ? Number.MAX_SAFE_INTEGER : at;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
}

export interface PinnedState {
  readonly pinned: readonly string[];
  isPinned(name: string): boolean;
  toggle(name: string): boolean;
}

/** Pins for one workspace, kept in React state and mirrored to localStorage. */
export function usePinned(workspaceId: string): PinnedState {
  const [pinned, setPinned] = useState<readonly string[]>(() => readPinned(workspaceId));

  useEffect(() => {
    setPinned(readPinned(workspaceId));
  }, [workspaceId]);

  const toggle = useCallback(
    (name: string): boolean => {
      const next = togglePinned(readPinned(workspaceId), name);
      writePinned(workspaceId, next);
      setPinned(next);
      return next.includes(name);
    },
    [workspaceId],
  );

  const isPinned = useCallback((name: string): boolean => pinned.includes(name), [pinned]);

  return { pinned, isPinned, toggle };
}
