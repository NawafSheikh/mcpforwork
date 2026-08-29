/**
 * What is being worked on right now, next to presence: "Maria's agent on Invoices".
 *
 * The header already says how many people and agents are here; this says what they are
 * doing. Same rule as the card badge: information, never a lock.
 */
import { useWorkspace } from "../../shell/context";
import { claimsLine } from "../claims";
import "./claims.css";

const TITLE = "Who is working on what right now. Nobody is blocked by it.";

/** The line for the header, or "" when nobody is mid-edit. */
export function useClaimsLine(): string {
  return claimsLine(useWorkspace());
}

/** Shown on its own when there is no room chip to hang the line off. */
export function ClaimsChip({ hide = false }: { readonly hide?: boolean }): JSX.Element | null {
  const line = useClaimsLine();
  if (hide || line.length === 0) return null;
  return (
    <span className="mfw-pill mfw-pill-ok" title={TITLE}>
      <span className="mfw-dot" aria-hidden="true" />
      {line}
    </span>
  );
}
