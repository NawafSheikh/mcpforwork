/**
 * "Saved just now" and its three neighbours.
 *
 * A person who asked "there is no save, is my work gone if I refresh?" is not reassured
 * by silence. This is the sentence that answers it, and it is pure so the test can say
 * exactly what each state reads as.
 */

import { formatRelative } from "../../shell/lib/format";
import type { SaveState } from "../types";

export function savedLabel(state: SaveState, savedAt: string, from: number = Date.now()): string {
  if (state === "memory") return "Not saved: this browser blocks storage";
  if (state === "saving") return "Saving...";
  const when = formatRelative(savedAt, from);
  return when === "just now" ? "Saved just now" : `Saved ${when}`;
}
