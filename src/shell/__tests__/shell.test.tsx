/** Shell render and wiring checks: every column paints, every published tool has a handler. */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { App } from "../../App";
import { ShellProvider } from "../context";
import { ToastProvider } from "../Toasts";
import { createWorkspaceStore } from "../../store";
import { sampleWorkspace } from "../../demo/sampleWorkspace";
import { MonitorsTab } from "../tabs/MonitorsTab";
import { ActivityTab } from "../tabs/ActivityTab";
import { AboutTab } from "../tabs/AboutTab";
import type { Workspace } from "../../types";
import { createWebmcp } from "../../webmcp";
import { TOOL_NAMES } from "../../webmcp/schemas";
import { monitorHandlers } from "../../monitors";
import { seedDemoHandler } from "../../demo/sampleWorkspace";
import { datasetHandlers } from "../../dataset/handlers";
import { roomHandlers } from "../../rooms/handlers";
import { turnHandlers } from "../../turns/tools";
import { capabilityHandlers } from "../../capabilities/tools";
import { workspaceHandlers } from "../../webmcp/handlers";
import { SHOWCASE_ROOM, START_COLLABORATING } from "../lib/constants";

const statusStore = {
  get: () => ({ available: false, registered: 0 }),
  subscribe: () => () => undefined,
};

function shell(node: ReactNode, seeded?: Workspace): string {
  const store = createWorkspaceStore(
    seeded ? { mode: "demo", initial: seeded, persist: false } : { mode: "demo", persist: false },
  );
  return renderToStaticMarkup(
    <ShellProvider store={store} statusStore={statusStore}>
      <ToastProvider>{node}</ToastProvider>
    </ShellProvider>,
  );
}

describe("shell", () => {
  it("renders the landing page on an empty board, with the rails around it", () => {
    const html = shell(<App />);
    expect(html).toContain("MCP for Work");
    expect(html).toContain("group them into");
    expect(html).toContain("WebMCP not available");
    // The live public room card sits above the hero, in the centre column.
    expect(html).toContain(SHOWCASE_ROOM);
    expect(html).toContain(START_COLLABORATING);
    // The rails are already there, and the empty members list explains rooms.
    expect(html).toContain("Members");
    expect(html).toContain("Places");
    expect(html).toContain("Press Invite");
  });

  it("renders the sample board through the dsl", () => {
    const html = shell(<App />, sampleWorkspace(new Date()));
    expect(html).toContain("mfw-dsl");
    // The board opens on the overview, with the categories as domain cards;
    // a single dashboard renders once a category is selected in the rail.
    expect(html).toContain("Workspace overview");
    expect(html).toContain("Invoices");
    // The categories are places in the left rail, not a second tab bar.
    expect(html).toContain("mfw-place");
  });

  it("renders monitors, drafts and a held clause", () => {
    const html = shell(<MonitorsTab />, sampleWorkspace(new Date()));
    expect(html).toContain("Approve");
    expect(html).toContain("Decline");
    expect(html).toContain("mfw-chip-held");
  });

  it("renders activity and about", () => {
    expect(shell(<ActivityTab />, sampleWorkspace(new Date()))).toContain("mfw-event");
    expect(shell(<AboutTab />)).toContain("Site tools");
  });

  it("keeps every feature one click away without a header button", () => {
    const html = shell(<App />, sampleWorkspace(new Date()));
    for (const label of ["Monitors", "Datasets", "Requests", "Activity", "About"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Invite");
    expect(html).toContain("Tools");
    expect(html).toContain("Next step");
    expect(html).toContain("Open for you");
    expect(html).toContain("Live");
  });
});

describe("shell wiring", () => {
  it("publishes all 30 tools", () => {
    const store = createWorkspaceStore({ mode: "demo", persist: false });
    const bundle = createWebmcp({ store, handlers: { ...monitorHandlers, seed_demo_workspace: seedDemoHandler } });
    expect(bundle.definitions.length).toBe(30);
    expect(TOOL_NAMES.length).toBe(30);
  });

  it("leaves no tool without a handler", () => {
    const wired = new Set([
      ...Object.keys(workspaceHandlers),
      ...Object.keys(monitorHandlers),
      ...Object.keys(roomHandlers),
      ...Object.keys(datasetHandlers),
      ...Object.keys(turnHandlers),
      ...Object.keys(capabilityHandlers),
      "seed_demo_workspace",
    ]);
    expect(TOOL_NAMES.filter((name) => !wired.has(name))).toEqual([]);
  });
});
