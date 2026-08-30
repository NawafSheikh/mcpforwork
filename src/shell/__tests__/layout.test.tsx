/**
 * The rendered half of the shell: the three columns, the phone tab bar, and the cards
 * that tell a person and their agent the same thing at the same time.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { App } from "../../App";
import { NAME_KEY, resetNameCache, setDisplayName } from "../../feedback";
import { emptyWorkspace, createWorkspaceStore } from "../../store";
import type { DraftAction, Workspace } from "../../types";
import { ShellProvider } from "../context";
import { ToastProvider } from "../Toasts";
import { NavProvider } from "../nav";
import {
  AGENT_HEADING,
  AGENT_OFF,
  AGENT_ON,
  CONTROLS_HEADING,
  NAME_QUESTION,
  PHONE_LABELS,
  PHONE_PANES,
} from "../lib/constants";
import { LeftRail } from "../rail/LeftRail";
import { RightPanel } from "../live/RightPanel";
import { RequestsPage } from "../center/RequestsPage";
import { DatasetsPage } from "../center/DatasetsPage";
import { LandingPage } from "../center/LandingPage";
import { Center } from "../center/Center";
import type { Place } from "../lib/places";
import { filledBoard } from "./fixture";

function forgetName(): void {
  resetNameCache();
  try {
    globalThis.localStorage?.removeItem(NAME_KEY);
  } catch {
    /* no storage under the test renderer, which reads the same as an empty one */
  }
}

beforeEach(forgetName);
afterEach(forgetName);

const statusStore = (available = false, registered = 0) => ({
  get: () => ({ available, registered }),
  subscribe: () => () => undefined,
});

function frame(node: ReactNode, seeded?: Workspace, available = false, at?: Place): string {
  const store = createWorkspaceStore(
    seeded ? { mode: "local", initial: seeded, persist: false } : { mode: "local", persist: false },
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
  const base = emptyWorkspace("local");
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
        store={createWorkspaceStore({ mode: "local", persist: false })}
        statusStore={statusStore()}
      >
        <App />
      </ShellProvider>,
    );

    expect(html).toContain("mfw-phonetabs");
    expect(html).toContain("data-pane=\"board\"");
    for (const pane of PHONE_PANES) expect(html).toContain(PHONE_LABELS[pane]);
  });
});

describe("the next step card", () => {
  it("asks for a name before anything else on a first run", () => {
    const html = frame(<RightPanel />);
    expect(html).toContain("Next step");
    expect(html).toContain("Tell us your name");
    expect(html).not.toContain("Start the board");
  });

  it("sends a named visitor into ChatGPT desktop, with the steps", () => {
    setDisplayName("Maria");
    const html = frame(<RightPanel />);
    expect(html).toContain("Open this page inside ChatGPT desktop");
    expect(html).toContain("Toggle side panel");
  });

  it("leads with the starter prompt on a cold board inside ChatGPT", () => {
    setDisplayName("Maria");
    const html = frame(<RightPanel />, undefined, true);
    expect(html).toContain("Start the board");
    expect(html).toContain("register_loop");
  });

  it("switches to the approve-all prompt when policy is holding something", () => {
    setDisplayName("Maria");
    const html = frame(<RightPanel />, withHeldDraft(), true);
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

  it("outside a room lists you and your agent, and nobody invented", () => {
    const html = frame(<LeftRail />);
    expect(html).toContain("You");
    expect(html).toContain(AGENT_HEADING);
    expect(html).toContain("not connected");
    expect(html).not.toContain("Someone");
  });

  it("uses the typed name and says the agent is here", () => {
    setDisplayName("Maria");
    const html = frame(<LeftRail />, undefined, true);
    expect(html).toContain("Maria");
    expect(html).toContain("ChatGPT");
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

describe("the first run", () => {
  it("asks the name, says the agent is missing, and lists what you control", () => {
    const html = frame(<LandingPage />);
    expect(html).toContain(NAME_QUESTION);
    expect(html).toContain(AGENT_OFF);
    expect(html).toContain("Toggle side panel");
    expect(html).toContain(CONTROLS_HEADING);
    for (const row of ["Board", "Guardrails", "Tools", "Rooms", "Data"]) {
      expect(html).toContain(row);
    }
    expect(html).toContain("empty, your agent builds it");
    expect(html).toContain("no monitors yet");
    expect(html).toContain("39 tools in 8 packs, all on");
    expect(html).toContain("only this browser");
    expect(html).toContain("nothing dropped");
  });

  it("drops the steps inside ChatGPT and leads with the prompt", () => {
    const html = frame(<LandingPage />, undefined, true);
    expect(html).toContain(AGENT_ON);
    expect(html).toContain("Copy the starter prompt");
    expect(html).not.toContain("Toggle side panel");
  });

  it("carries no sample board, no showcase room and no replay", () => {
    const html = frame(<LandingPage />);
    expect(html).not.toContain("Live public room");
    expect(html).not.toContain("See a finished example");
    expect(html).not.toContain("Load sample workspace");
    expect(html).not.toContain("Watch it build");
  });
});

describe("the centre column", () => {
  it("opens one category with its dashboard and the turn toggle", () => {
    const html = frame(<Center />, filledBoard(), false, {
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
    expect(html).not.toContain(NAME_QUESTION);
  });
});
