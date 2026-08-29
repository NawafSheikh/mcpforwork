/** Shell render and wiring checks: every column paints, every published tool has a handler. */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { App } from "../../App";
import { ShellProvider } from "../context";
import { ToastProvider } from "../Toasts";
import { createWorkspaceStore } from "../../store";
import { MonitorsTab } from "../tabs/MonitorsTab";
import { ActivityTab } from "../tabs/ActivityTab";
import { AboutTab } from "../tabs/AboutTab";
import type { Workspace } from "../../types";
import { createWebmcp } from "../../webmcp";
import { TOOL_NAMES } from "../../webmcp/schemas";
import { monitorHandlers } from "../../monitors";
import { datasetHandlers } from "../../dataset/handlers";
import { roomHandlers } from "../../rooms/handlers";
import { turnHandlers } from "../../turns/tools";
import { capabilityHandlers } from "../../capabilities/tools";
import { workspaceHandlers } from "../../webmcp/handlers";
import { AGENT_OFF, CONTROLS_HEADING, NAME_QUESTION } from "../lib/constants";
import { filledBoard } from "./fixture";

const statusStore = {
  get: () => ({ available: false, registered: 0 }),
  subscribe: () => () => undefined,
};

function shell(node: ReactNode, seeded?: Workspace): string {
  const store = createWorkspaceStore(
    seeded ? { mode: "local", initial: seeded, persist: false } : { mode: "local", persist: false },
  );
  return renderToStaticMarkup(
    <ShellProvider store={store} statusStore={statusStore}>
      <ToastProvider>{node}</ToastProvider>
    </ShellProvider>,
  );
}

describe("shell", () => {
  it("opens on the three first-run questions, with the rails around them", () => {
    const html = shell(<App />);
    expect(html).toContain("MCP for Work");
    expect(html).toContain(NAME_QUESTION);
    expect(html).toContain(AGENT_OFF);
    expect(html).toContain(CONTROLS_HEADING);
    expect(html).toContain("group them into");
    expect(html).toContain("WebMCP not available");
    // The rails are already there, and the empty members list explains rooms.
    expect(html).toContain("Members");
    expect(html).toContain("Places");
    expect(html).toContain("Press Invite");
  });

  it("keeps every sample and showcase entry point off the page", () => {
    const html = shell(<App />);
    expect(html).not.toContain("Live public room");
    expect(html).not.toContain("Load sample workspace");
    expect(html).not.toContain("See a finished example");
    expect(html).not.toContain("Watch it build");
    expect(html).not.toContain("Someone");
  });

  it("renders a filled board through the dsl", () => {
    const html = shell(<App />, filledBoard());
    expect(html).toContain("mfw-dsl");
    // The board opens on the overview, with the categories as domain cards;
    // a single dashboard renders once a category is selected in the rail.
    expect(html).toContain("Workspace overview");
    expect(html).toContain("Invoices");
    // The categories are places in the left rail, not a second tab bar.
    expect(html).toContain("mfw-place");
    expect(html).not.toContain(NAME_QUESTION);
  });

  it("renders monitors, drafts and a held clause", () => {
    const html = shell(<MonitorsTab />, filledBoard());
    expect(html).toContain("Approve");
    expect(html).toContain("Decline");
    expect(html).toContain("mfw-chip-held");
    expect(html).not.toContain("Run now");
  });

  it("renders activity and about", () => {
    expect(shell(<ActivityTab />, filledBoard())).toContain("mfw-event");
    expect(shell(<AboutTab />)).toContain("Site tools");
  });

  it("keeps every feature one click away without a header button", () => {
    const html = shell(<App />, filledBoard());
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
  it("publishes all 29 tools", () => {
    const store = createWorkspaceStore({ mode: "local", persist: false });
    const bundle = createWebmcp({ store, handlers: { ...monitorHandlers } });
    expect(bundle.definitions.length).toBe(29);
    expect(TOOL_NAMES.length).toBe(29);
    expect(TOOL_NAMES).not.toContain("seed_demo_workspace");
  });

  it("leaves no tool without a handler", () => {
    const wired = new Set([
      ...Object.keys(workspaceHandlers),
      ...Object.keys(monitorHandlers),
      ...Object.keys(roomHandlers),
      ...Object.keys(datasetHandlers),
      ...Object.keys(turnHandlers),
      ...Object.keys(capabilityHandlers),
    ]);
    expect(TOOL_NAMES.filter((name) => !wired.has(name))).toEqual([]);
  });
});
