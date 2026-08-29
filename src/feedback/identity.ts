/**
 * The visitor's display name, so a note can read "Maria: the EUR 7,200 invoice needs you"
 * instead of "human". It is a courtesy label, never an identity claim: it lives in this
 * browser's localStorage, it is self-reported, and nothing is ever authorised by it.
 *
 * Storage throws in private mode and does not exist at all under the test renderer, so
 * every read and write is guarded and the module keeps its own copy in memory.
 */

import { LIMITS } from "../types";

export const NAME_KEY = "mfw:name";
export const DEFAULT_NAME = "Someone";
export const MAX_NAME_CHARS = LIMITS.maxCallerChars;

const listeners = new Set<() => void>();
let cached: string | null = null;

function clean(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim().slice(0, MAX_NAME_CHARS).trim();
  return trimmed.length === 0 ? DEFAULT_NAME : trimmed;
}

function read(): string {
  try {
    return clean(globalThis.localStorage?.getItem(NAME_KEY));
  } catch {
    return DEFAULT_NAME;
  }
}

/** What to sign this browser's notes with. Reads storage once, then keeps it in memory. */
export function displayName(): string {
  if (cached === null) cached = read();
  return cached;
}

/** Store a new name and tell every chip on the page. Returns the name actually kept. */
export function setDisplayName(next: string): string {
  const name = clean(next);
  cached = name;
  try {
    globalThis.localStorage?.setItem(NAME_KEY, name);
  } catch {
    /* a name this browser refuses to remember is not worth failing a render over */
  }
  for (const listener of [...listeners]) listener();
  return name;
}

/** Subscribe a component to renames. Returns the unsubscribe. */
export function subscribeName(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests and the "forget me" path: drop the cached name without touching storage. */
export function resetNameCache(): void {
  cached = null;
}
