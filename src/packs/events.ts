/**
 * Two very small buses, so this module can tell the shell something without importing it.
 *
 * `packToasts` carries what the local bridge says while nobody is looking at the panel:
 * a queued action, a boundary refusal, a run that finished. `askCapability` carries the
 * "ask this agent" click from a capability card to whatever composer is mounted, as an
 * add_feedback-shaped target and a first line the person can edit before sending.
 *
 * A bus keeps the last few messages so a component that mounts late still has something
 * to draw. Nothing here is persisted and nothing here crosses the wire.
 */

import type { FeedbackTargetKind } from "../types";

const KEEP = 8;

export interface Bus<T> {
  emit(value: T): void;
  subscribe(listener: (value: T) => void): () => void;
  /** The last few values, oldest first. */
  recent(): readonly T[];
  clear(): void;
}

function createBus<T>(keep: number = KEEP): Bus<T> {
  const listeners = new Set<(value: T) => void>();
  let history: readonly T[] = [];
  return {
    emit(value: T): void {
      history = [...history, value].slice(-keep);
      for (const listener of [...listeners]) listener(value);
    },
    subscribe(listener: (value: T) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    recent: () => history,
    clear(): void {
      history = [];
    },
  };
}

export type ToastTone = "info" | "warn";

export interface PackToast {
  readonly id: string;
  readonly text: string;
  readonly tone: ToastTone;
  readonly at: string;
}

/** What a capability card hands the composer: a target and a first line to edit. */
export interface AskRequest {
  readonly target: { readonly kind: FeedbackTargetKind; readonly id: string };
  readonly text: string;
}

export const packToasts: Bus<PackToast> = createBus<PackToast>();
export const askCapability: Bus<AskRequest> = createBus<AskRequest>(1);

let counter = 0;

export function emitPackToast(text: string, tone: ToastTone = "info"): PackToast {
  counter += 1;
  const toast: PackToast = {
    id: `pt-${Date.now().toString(36)}-${counter}`,
    text,
    tone,
    at: new Date().toISOString(),
  };
  packToasts.emit(toast);
  return toast;
}
