/** Shell render and wiring checks: every tab paints, every published tool has a handler. */
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
import { workspaceHandlers } from "../../webmcp/handlers";


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
  it("renders the empty board", () => {
    const html = shell(<App />);
    expect(html).toContain("MCP for Work");
    expect(html).toContain("group them into");
    expect(html).toContain("WebMCP not available");
  });

  it("renders the sample board through the dsl", () => {
    const html = shell(<App />, sampleWorkspace(new Date()));
    expect(html).toContain("mfw-dsl");
    // The board opens on the overview, with the categories as domain cards;
    // a single dashboard renders once a category is selected.
    expect(html).toContain("Workspace overview");
    expect(html).toContain("Invoices");
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
});

describe("shell wiring", () => {
  it("publishes all 25 tools", () => {
    const store = createWorkspaceStore({ mode: "demo", persist: false });
    const bundle = createWebmcp({ store, handlers: { ...monitorHandlers, seed_demo_workspace: seedDemoHandler } });
    expect(bundle.definitions.length).toBe(25);
    expect(TOOL_NAMES.length).toBe(25);
  });

  it("leaves no tool without a handler", () => {
    const wired = new Set([
      ...Object.keys(workspaceHandlers),
      ...Object.keys(monitorHandlers),
      ...Object.keys(roomHandlers),
      ...Object.keys(datasetHandlers),
      "seed_demo_workspace",
    ]);
    expect(TOOL_NAMES.filter((name) => !wired.has(name))).toEqual([]);
  });
});
