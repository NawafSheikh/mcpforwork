/**
 * Who is working on this object, and the toggle that says it is you.
 *
 * Taking a turn never takes anything away from anybody: the badge is information and a
 * second person editing the same card is merged, not refused (docs/TURNS.md). The toggle
 * exists because saying "I am on this" before you start is politeness, not permission.
 */
import { useCallback } from "react";
import { useDisplayName } from "../../feedback";
import { heldByMe, humanWrite, personRelease } from "../../turns";
import { ClaimBadge } from "../../turns/ui";
import type { ClaimTarget } from "../../types";
import { useShell, useWorkspace } from "../context";

export function HolderRow({ target }: { readonly target: ClaimTarget }): JSX.Element {
  const { store } = useShell();
  const workspace = useWorkspace();
  const me = useDisplayName();
  const mine = heldByMe(workspace, target, me);

  const onToggle = useCallback(() => {
    void store.update((ws) =>
      heldByMe(ws, target, me) ? personRelease(ws, target, me) : humanWrite(ws, target, me),
    );
  }, [store, target, me]);

  return (
    <div className="mfw-holder">
      <ClaimBadge target={target} />
      <button
        type="button"
        className={mine ? "mfw-btn mfw-btn-primary" : "mfw-btn mfw-btn-ghost"}
        aria-pressed={mine}
        onClick={onToggle}
      >
        {mine ? "Hand it back" : "I am working on this"}
      </button>
    </div>
  );
}
