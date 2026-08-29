/**
 * The rendered half of the new shell: the three columns, the phone tab bar, and the
 * cards that tell a person and their agent the same thing at the same time.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { App } from "../../App";
import { sampleWorkspace } from "../../demo/sampleWorkspace";
import { emptyWorkspace, createWorkspaceStore } from "../../store";
import type { DraftAction, Workspace } from "../../types";
import { ShellProvider } from "../context";
import { ToastProvider } from "../Toasts";
import { NavProvider } from "../nav";
import { PHONE_LABELS, PHONE_PANES, ROBOT_STATUS, SHOWCASE_UNKNOWN } from "../lib/constants";
import { LeftRail } from "../rail/LeftRail";
import { RightPanel } from "../live/RightPanel";
import { RequestsPage } from "../center/RequestsPage";
import { DatasetsPage } from "../center/DatasetsPage";
import { LandingPage, robotLine } from "../center/LandingPage";
import { Center } from "../center/Center";
import type { Place } from "../lib/places";

const statusStore = (available = false, registered = 0) => ({
  get: () => ({ available, registered }),
  subscribe: () => () => undefined,
});

function frame(node: ReactNode, seeded?: Workspace, available = false, at?: Place): string {
  const store = createWorkspaceStore(
    seeded ? { mode: "demo", initial: seeded, persist: false } : { mode: "demo", persist: false },
  );
  return renderToStaticMarkup(
    <ShellProvider store={store} statusStore={statusStore(available, available ? 28 : 0)}>
      <ToastProvider>
        <NavProvider {...(at === undefined ? {} : { initial: at })}>{node}</NavProvider>
      </ToastProvider>
    </ShellProvider>,
  );
}

const HELD: DraftAction = {
  id: "draft_1",
  monitorId: "mon_1",
  runId: "run_1",
  kind: "pay",
  target: "ACME invoice",
  summary: "Pay EUR 6,300",
  status: "held",
  heldReason: "threshold:amount>5000",
};

function withHeldDraft(): Workspace {
  const base = emptyWorkspace("demo");
  return {
    ...base,
    categories: {
      Invoices: { name: "Invoices", createdAt: base.updatedAt },
    },
    drafts: { [HELD.id]: HELD },
  };
}

describe("the phone layout", () => {
  it("puts a bottom tab bar on the page with the four panes", () => {
    const html = renderToStaticMarkup(
      <ShellProvider
        store={createWorkspaceStore({ mode: "demo", persist: false })}
        statusStore={statusStore()}
      >
        <App />
      </ShellProvider>,
    );

    expect(html).toContain("mfw-phonetabs");
    expect(html).toContain('data-pane="board"');
    for (const pane of PHONE_PANES) expect(html).toContain(PHONE_LABELS[pane]);
  });
});

describe("the next step card", () => {
  it("leads with the starter prompt on a cold board", () => {
    const html = frame(<RightPanel />);
    expect(html).toContain("Next step");
    expect(html).toContain("Start the board");
    expect(html).toContain("group them into");
  });

  it("switches to the approve-all prompt when policy is holding something", () => {
    const html = frame(<RightPanel />, withHeldDraft());
    expect(html).toContain("held for a decision");
    expect(html).toContain("including the ones marked held");
  });

  it("shows what is open for you next to it", () => {
    const html = frame(<RightPanel />, withHeldDraft());
    expect(html).toContain("Open for you");
    expect(html).toContain("Held for you: ACME invoice");
  });
});

describe("the left rail", () => {
  it("shows the members and the places, and explains an empty room", () => {
    const html = frame(<LeftRail />, withHeldDraft());
    expect(html).toContain("Members");
    expect(html).toContain("Places");
    expect(html).toContain("Press Invite");
    expect(html).toContain("Invoices");
    expect(html).toContain("Monitors");
  });
});

describe("the requests page", () => {
  it("carries the composer with a target picker and the honest hint", () => {
    const html = frame(<RequestsPage />);
    expect(html).toContain("Everyone in this room");
    expect(html).toContain("Any agent here");
    expect(html).toContain("runs in your ChatGPT, not here");
    expect(html).toContain("Room requests");
  });
});

describe("the datasets page", () => {
  it("keeps the drop zone reachable away from the overview", () => {
    expect(frame(<DatasetsPage />)).toContain("Drop a CSV or XLSX");
  });
});

describe("the landing page", () => {
  it("puts the live room card above the hero, with the robot on it", () => {
    const html = frame(<LandingPage />);
    expect(html).toContain("Live public room");
    expect(html).toContain(SHOWCASE_UNKNOWN);
    expect(html).toContain(robotLine());
    expect(html).toContain(ROBOT_STATUS.name);
    expect(html).toContain("A workspace for people and their agents");
  });

  it("drops the room card inside ChatGPT and says the agent is in the room", () => {
    const html = frame(<LandingPage />, undefined, true);
    expect(html).toContain("Your agent is in the room");
    expect(html).not.toContain("Live public room");
  });
});

describe("the centre column", () => {
  it("opens one category with its dashboard and the turn toggle", () => {
    const html = frame(<Center />, sampleWorkspace(new Date()), false, {
      kind: "category",
      name: "Invoices",
    });

    expect(html).toContain("mfw-dsl");
    expect(html).toContain("I am working on this");
    // The notes slot for the agent travels with the dashboard.
    expect(html).toContain("Leave a note for the agent");
  });

  it("keeps the monitors page reachable on a cold board", () => {
    const html = frame(<Center />, undefined, false, { kind: "monitors" });
    expect(html).toContain("Approval queue");
    expect(html).not.toContain("Live public room");
  });
});
