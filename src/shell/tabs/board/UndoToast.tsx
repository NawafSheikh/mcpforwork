/**
 * Local undo toast for a deleted chart. Five seconds, then it dismisses itself.
 * Rendered by the board rather than the global toast stack, because the undo it
 * offers only makes sense while the board that raised it is on screen.
 */

import { useEffect } from "react";
import "./board.css";

export const UNDO_MS = 5000;

export interface UndoToastProps {
  readonly message: string;
  readonly onUndo: () => void;
  readonly onDismiss: () => void;
  readonly ms?: number;
}

export function UndoToast({ message, onUndo, onDismiss, ms = UNDO_MS }: UndoToastProps): JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onDismiss, ms);
    return () => clearTimeout(timer);
  }, [ms, onDismiss]);

  return (
    <div className="mfw-undo" role="status" aria-live="polite">
      <span className="mfw-undo__text">{message}</span>
      <button type="button" className="mfw-undo__btn" onClick={onUndo}>
        Undo
      </button>
      <button type="button" className="mfw-undo__close" onClick={onDismiss} aria-label="Dismiss">
        {"×"}
      </button>
    </div>
  );
}
