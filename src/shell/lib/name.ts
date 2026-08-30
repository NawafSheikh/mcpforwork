/**
 * The name on this browser, read the way the shell needs it.
 *
 * src/feedback stores a courtesy label and falls back to a generic word when nobody has
 * typed anything. The shell never shows that word: an unnamed visitor is "You" in the
 * rail and "Set your name" in the top bar, and the first run asks the question outright.
 */
import { DEFAULT_NAME, setDisplayName, useDisplayName } from "../../feedback";
import { setRoomLabel } from "../../rooms";
import { YOU } from "./constants";

export interface MyName {
  /** What is stored, which is the generic fallback until somebody types. */
  readonly name: string;
  readonly isSet: boolean;
  /** What to put on screen for this browser: the name, or "You". */
  readonly label: string;
}

export function readMyName(stored: string): MyName {
  const isSet = stored.trim().length > 0 && stored !== DEFAULT_NAME;
  return { name: stored, isSet, label: isSet ? stored : YOU };
}

export function useMyName(): MyName {
  return readMyName(useDisplayName());
}

/**
 * Save a typed name and tell the room, so the chip, the rail and every peer agree at
 * once. A blank field is not a name, so it is refused rather than stored as one.
 *
 * setRoomLabel and not getRoomRuntime().setLabel: most people type their name before any
 * room exists, and a live runtime is the one case that already worked.
 */
export function saveMyName(next: string): string | null {
  if (next.trim().length === 0) return null;
  const saved = setDisplayName(next);
  setRoomLabel(saved);
  return saved;
}
