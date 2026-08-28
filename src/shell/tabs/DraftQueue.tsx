/** The approval queue. A human can approve or decline anything, always. */
import { useCallback } from "react";
import type { DraftAction, DraftStatus } from "../../types";
import { decideDraft } from "../adapters/monitors";
import { useShell, useWorkspace } from "../context";
import { truncate } from "../lib/format";
import { useToast } from "../Toasts";

const ORDER: Readonly<Record<DraftStatus, number>> = {
  held: 0,
  pending: 1,
  auto: 2,
  approved: 3,
  declined: 4,
};

function DraftRow({ draft }: { readonly draft: DraftAction }): JSX.Element {
  const { store } = useShell();
  const push = useToast();

  const decide = useCallback(
    async (decision: "approved" | "declined") => {
      const message = await decideDraft(store, draft.id, decision);
      push(truncate(message, 140), decision === "approved" ? "ok" : "info");
    },
    [store, draft.id, push],
  );

  return (
    <li className="mfw-draft">
      <div className="mfw-draft-main">
        <span className={`mfw-chip mfw-chip-${draft.status}`}>{draft.status}</span>
        <span className="mfw-draft-target">{draft.target}</span>
        <span className="mfw-muted">{draft.summary}</span>
        {draft.heldReason ? (
          <span className="mfw-danger">Held by policy clause: {draft.heldReason}</span>
        ) : null}
        <span className="mfw-draft-meta">
          {draft.kind}
          {typeof draft.amount === "number" ? ` | ${draft.amount}` : ""}
          {draft.decidedBy ? ` | decided by ${draft.decidedBy}` : ""}
        </span>
      </div>
      <div className="mfw-draft-actions">
        <button type="button" className="mfw-btn mfw-btn-primary" onClick={() => void decide("approved")}>
          Approve
        </button>
        <button type="button" className="mfw-btn mfw-btn-ghost" onClick={() => void decide("declined")}>
          Decline
        </button>
      </div>
    </li>
  );
}

export function DraftQueue(): JSX.Element {
  const workspace = useWorkspace();
  const drafts = Object.values(workspace.drafts).sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  return (
    <section className="mfw-card mfw-queue">
      <header className="mfw-queue-head">
        <h3>Approval queue</h3>
        <p className="mfw-muted">
          The agent proposes. Policy sorts. You decide, and every decision is on the audit rail.
        </p>
      </header>
      {drafts.length === 0 ? (
        <p className="mfw-muted">No drafts yet. Monitors put their proposals here.</p>
      ) : (
        <ul className="mfw-draft-list">
          {drafts.map((draft) => (
            <DraftRow draft={draft} key={draft.id} />
          ))}
        </ul>
      )}
    </section>
  );
}
