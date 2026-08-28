/**
 * Bootstrap: one store, one root, and one decision made before anything renders.
 *
 * A URL with a #share= fragment is a read-only snapshot of somebody else's board, so it
 * gets an in-memory store, no scheduler and, above all, no registered site tools: a
 * visitor's agent must never be handed write tools pointed at a stranger's snapshot.
 */
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import { hasShareFragment, readShareFromLocation } from "./share";
import { createStore } from "./shell/adapters/store";
import { startScheduler } from "./shell/adapters/monitors";
import { registerTools, type WebmcpStatusStore } from "./shell/adapters/webmcp";
import { ShellProvider } from "./shell/context";
import { initTheme } from "./shell/lib/theme";
/** Snapshots need a store that never persists, which the shell adapter does not expose. */
import { createWorkspaceStore } from "./store";
import type { Workspace, WorkspaceMode, WorkspaceStore } from "./types";
import "./styles/app.css";

const IDLE_STATUS: WebmcpStatusStore = {
  get: () => ({ available: false, registered: 0 }),
  subscribe: () => () => undefined,
};

function readMode(): WorkspaceMode {
  return new URLSearchParams(window.location.search).get("mode") === "live" ? "live" : "demo";
}

/** index.html is owned elsewhere, so the shell attaches its own icon. */
function ensureFavicon(): void {
  if (document.querySelector("link[rel='icon']")) return;
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.href = "/favicon.svg";
  document.head.appendChild(link);
}

function mount(
  root: Root,
  store: WorkspaceStore,
  statusStore: WebmcpStatusStore,
  snapshot: boolean,
): void {
  root.render(
    <StrictMode>
      <ShellProvider store={store} statusStore={statusStore}>
        <App snapshot={snapshot} />
      </ShellProvider>
    </StrictMode>,
  );
}

/** The visitor's own board: tools registered once, demo monitors ticking. */
function mountWorkspace(root: Root): void {
  const mode = readMode();
  const store = createStore({ mode });
  const controller = new AbortController();
  const statusStore = registerTools(store, controller.signal);
  const stopScheduler = mode === "demo" ? startScheduler(store) : (): void => undefined;
  window.addEventListener(
    "pagehide",
    () => {
      stopScheduler();
      controller.abort();
    },
    { once: true },
  );
  mount(root, store, statusStore, false);
}

function mountSnapshot(root: Root, workspace: Workspace): void {
  const store = createWorkspaceStore({ mode: "demo", persist: false, initial: workspace });
  mount(root, store, IDLE_STATUS, true);
}

initTheme();
ensureFavicon();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("root element missing");
const reactRoot = createRoot(rootElement);

if (hasShareFragment()) {
  void readShareFromLocation().then((workspace) => {
    if (workspace === null) mountWorkspace(reactRoot);
    else mountSnapshot(reactRoot, workspace);
  });
} else {
  mountWorkspace(reactRoot);
}
