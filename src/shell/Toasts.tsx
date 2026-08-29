/** Toast host plus the bridge that turns new agent tool calls into toasts. */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { packToasts } from "../packs";
import { useWorkspace } from "./context";
import { describeToolEvent } from "./lib/format";
import { newId } from "./lib/ids";

export type ToastTone = "info" | "ok" | "warn";

interface Toast {
  readonly id: string;
  readonly text: string;
  readonly tone: ToastTone;
}

type PushToast = (text: string, tone?: ToastTone) => void;

const ToastContext = createContext<PushToast>(() => undefined);

const TOAST_MS = 5000;
const MAX_TOASTS = 3;

export function ToastProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const timers = useRef<number[]>([]);

  const push = useCallback<PushToast>((text, tone = "info") => {
    const toast: Toast = { id: newId("toast"), text, tone };
    setToasts((current) => [...current, toast].slice(-MAX_TOASTS));
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id));
    }, TOAST_MS);
    timers.current = [...timers.current, timer];
  }, []);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="mfw-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`mfw-toast mfw-toast-${toast.tone}`} key={toast.id}>
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): PushToast {
  return useContext(ToastContext);
}

/**
 * The local bridge talks while nobody is looking at the packs panel: a queued action, a
 * boundary refusal, a run that finished. Those are toasts like any other.
 */
export function PackToastBridge(): null {
  const push = useToast();
  useEffect(() => packToasts.subscribe((toast) => push(toast.text, toast.tone)), [push]);
  return null;
}

/** Watches the audit rail and announces every new agent tool call once. */
export function ToolToastBridge(): null {
  const workspace = useWorkspace();
  const push = useToast();
  const seen = useRef<ReadonlySet<string> | null>(null);

  useEffect(() => {
    const ids = new Set(workspace.audit.map((event) => event.id));
    if (seen.current === null) {
      seen.current = ids;
      return;
    }
    const previous = seen.current;
    const fresh = workspace.audit.filter((event) => !previous.has(event.id) && event.actor === "agent");
    seen.current = ids;
    for (const event of fresh.slice(-MAX_TOASTS)) {
      push(describeToolEvent(event), event.ok ? "ok" : "warn");
    }
  }, [workspace.audit, push]);

  return null;
}
