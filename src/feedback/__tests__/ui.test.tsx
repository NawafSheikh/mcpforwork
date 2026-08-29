/** FeedbackBox paints open notes, the input and the resolved fold. */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkspaceStore } from "../../store/createStore";
import { ShellProvider } from "../../shell/context";
import { FeedbackBox } from "../ui/FeedbackBox";
import { addFeedback, resolveFeedback } from "../store";
import type { FeedbackTarget, Workspace } from "../../types";

const target: FeedbackTarget = { kind: "dashboard", id: "Invoices" };

const statusStore = {
  get: () => ({ available: false, registered: 0 }),
  subscribe: () => () => undefined,
};

function paint(seed: (ws: Workspace) => Workspace, compact?: boolean): string {
  const store = createWorkspaceStore({ mode: "local", persist: false });
  const initial = seed(store.get());
  const seeded = createWorkspaceStore({ mode: "local", persist: false, initial });
  return renderToStaticMarkup(
    <ShellProvider store={seeded} statusStore={statusStore}>
      <FeedbackBox target={target} compact={compact} />
    </ShellProvider>,
  );
}

describe("FeedbackBox", () => {
  it("shows the input and no notes on an empty board", () => {
    const html = paint((ws) => ws);
    expect(html).toContain("Leave a note for the agent");
    expect(html).toContain("none open");
    expect(html).not.toContain("Resolved (");
  });

  it("lists an open note with its author chip and a resolve button", () => {
    const html = paint((ws) => addFeedback(ws, { target, text: "y axis is wrong", author: "human" }));
    expect(html).toContain("y axis is wrong");
    expect(html).toContain("mfw-fb-author-human");
    expect(html).toContain("Resolve");
    expect(html).toContain("1 open");
  });

  it("folds resolved notes away behind a count", () => {
    const html = paint((ws) => {
      const added = addFeedback(ws, { target, text: "rename it", author: "human" });
      const id = Object.keys(added.feedback)[0] as string;
      return resolveFeedback(added, id, { by: "agent", resolution: "Renamed it" }) ?? added;
    });
    expect(html).toContain("Resolved (1)");
    expect(html).not.toContain("Renamed it");
  });

  it("drops the heading when compact", () => {
    const html = paint((ws) => ws, true);
    expect(html).toContain("mfw-fb-compact");
    expect(html).not.toContain("Notes for the agent");
  });
});
