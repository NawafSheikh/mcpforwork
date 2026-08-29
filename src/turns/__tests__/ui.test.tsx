/** What a person sees of a turn: a badge on the card, a line in the header. */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkspaceStore } from "../../store/createStore";
import { ShellProvider } from "../../shell/context";
import { describeToolEvent } from "../../shell/lib/format";
import { ClaimBadge } from "../ui/ClaimBadge";
import { ClaimsChip } from "../ui/ClaimsChip";
import { holdClaim } from "../claims";
import type { ClaimTarget, Workspace } from "../../types";

const INVOICES: ClaimTarget = { kind: "dashboard", id: "Invoices" };

const statusStore = {
  get: () => ({ available: false, registered: 0 }),
  subscribe: () => () => undefined,
};

function paint(node: JSX.Element, seed: (ws: Workspace) => Workspace = (ws) => ws): string {
  const base = createWorkspaceStore({ mode: "local", persist: false });
  const store = createWorkspaceStore({ mode: "local", persist: false, initial: seed(base.get()) });
  return renderToStaticMarkup(
    <ShellProvider store={store} statusStore={statusStore}>
      {node}
    </ShellProvider>,
  );
}

const withAgent = (ws: Workspace): Workspace =>
  holdClaim(ws, { target: INVOICES, holder: "Maria's agent", holderKind: "agent" });

const withPerson = (ws: Workspace): Workspace =>
  holdClaim(ws, { target: { kind: "overview", id: "overview" }, holder: "Nawaf", holderKind: "person" });

describe("the claim badge", () => {
  it("says who is working on this card", () => {
    const html = paint(<ClaimBadge target={INVOICES} />, withAgent);

    expect(html).toContain("Maria&#x27;s agent is working on this");
    expect(html).toContain("mfw-claim-agent");
    expect(html).toContain("just now");
  });

  it("shows nothing at all when nobody is on it", () => {
    expect(paint(<ClaimBadge target={INVOICES} />)).toBe("");
  });

  it("offers no control: it is information, not a lock", () => {
    const html = paint(<ClaimBadge target={INVOICES} />, withAgent);

    expect(html).not.toContain("<button");
    expect(html).toContain("edit when you need to");
  });

  it("colours a person's turn differently from an agent's", () => {
    const html = paint(<ClaimBadge target={{ kind: "overview", id: "overview" }} />, withPerson);

    expect(html).toContain("mfw-claim-person");
    expect(html).toContain("Nawaf is working on this");
  });
});

describe("the header line", () => {
  it("names who is on what", () => {
    const html = paint(<ClaimsChip />, (ws) => withPerson(withAgent(ws)));

    expect(html).toContain("Maria&#x27;s agent on Invoices");
    expect(html).toContain("Nawaf on the overview");
  });

  it("stays out of the way when there is a room chip already", () => {
    expect(paint(<ClaimsChip hide />, withAgent)).toBe("");
    expect(paint(<ClaimsChip />)).toBe("");
  });
});

describe("a refused write in the rail and the toast", () => {
  const refusal =
    'Ana changed chart "By supplier" 20 s ago and this would delete it. Call get_dashboard again, then send your change on top.';

  it("quotes the refusal instead of summarising the tool", () => {
    const line = describeToolEvent({
      id: "ev_1",
      at: "2026-08-29T10:00:00.000Z",
      actor: "agent",
      caller: "Ben",
      tool: "upsert_dashboard",
      result: refusal,
      ok: false,
    });

    expect(line).toContain("Ana changed");
    expect(line).toContain("Call get_dashboard again");
    expect(line).not.toContain("ChatGPT built dashboard");
  });

  it("still describes a call that worked", () => {
    const line = describeToolEvent({
      id: "ev_2",
      at: "2026-08-29T10:00:00.000Z",
      actor: "agent",
      tool: "upsert_dashboard",
      argsPreview: '{"category":"Invoices"}',
      result: "Dashboard for Invoices rendered with 2 KPIs and 1 charts.",
      ok: true,
    });

    expect(line).toBe("ChatGPT built dashboard: Invoices");
  });
});
