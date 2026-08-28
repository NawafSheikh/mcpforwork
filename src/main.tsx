/**
 * Bootstrap: one store, one root, and one decision made before anything renders.
 *
 * A URL with a #share= fragment is a read-only snapshot of somebody else's board, so it
 * gets an in-memory store, no scheduler, no room and, above all, no registered site tools:
 * a visitor's agent must never be handed write tools pointed at a stranger's snapshot.
 *
 * A ?room= slug is the opposite: a live shared board. The fragment is checked first, so a
 * snapshot link never joins anything even when both are present.
 */
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import {
  configureRooms,
  currentRoomSlug,
  joinRoom,
  leaveRoom,
  roomJoinUrl,
  roomStoreKey,
} from "./rooms";
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

/**
 * A room-scoped board persists under its own key, so two rooms and the local board never
 * overwrite each other. src/rooms never touches IndexedDB: the store owns its key, so
 * re-keying on the way into a room happens here.
 */
function storeFor(mode: WorkspaceMode, slug: string | null): WorkspaceStore {
  return slug === null
    ? createStore({ mode })
    : createWorkspaceStore({ mode, key: roomStoreKey(slug) });
}

/** Rooms, for the visitor's own board only. A #share snapshot never reaches this. */
function startRooms(store: WorkspaceStore, slug: string | null): void {
  configureRooms({
    store,
    label: "Guest",
    agent: false, // The header flips this from the WebMCP status once tools register.
    onRoom: (opened: string) => {
      window.history.replaceState(null, "", roomJoinUrl(opened));
      // Move persistence to the room key rather than copying the board once: a one-shot
      // copy saves the board as it looked the instant the room opened, and every later
      // edit keeps going to the old key, so reloading the room URL reads back an empty
      // board. rekey is a no-op when the page already booted on this slug, so a
      // hydration still in flight is never clobbered.
      void (store as { rekey?: (next: string) => Promise<void> }).rekey?.(roomStoreKey(opened));
    },
  });
  if (slug !== null) joinRoom(slug);
}

/** The visitor's own board: tools registered once, demo monitors ticking. */
function mountWorkspace(root: Root): void {
  const mode = readMode();
  const slug = currentRoomSlug();
  const store = storeFor(mode, slug);
  const controller = new AbortController();
  const statusStore = registerTools(store, controller.signal);
  const stopScheduler = mode === "demo" ? startScheduler(store) : (): void => undefined;
  startRooms(store, slug);
  window.addEventListener(
    "pagehide",
    () => {
      stopScheduler();
      leaveRoom();
      controller.abort();
      // Best effort: pagehide gives no second chance, so a failed flush has no recovery path.
      void (store as { flush?: () => Promise<void> }).flush?.().catch(() => undefined);
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
