/**
 * Bootstrap: one store, one root, and one decision made before anything renders.
 *
 * A URL with a #share= fragment is a read-only snapshot of somebody else's board, so it
 * gets an in-memory store, no scheduler, no room and, above all, no registered site tools:
 * a visitor's agent must never be handed write tools pointed at a stranger's snapshot.
 *
 * A ?room= slug is the opposite: a live shared board. The fragment is checked first, so a
 * snapshot link never joins anything even when both are present.
 *
 * Rooms are encrypted end to end and the key rides in the same fragment (#k=). A room link
 * that arrives without its key cannot be read at all, so this file shows the locked card
 * and never joins: there is nothing useful a browser without the key could do in the room.
 */
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import { fingerprint, parseInvite } from "./crypto";
import { displayName } from "./feedback";
import {
  configureRooms,
  inviteUrl,
  joinRoom,
  leaveRoom,
  roomStorageKey,
  roomStoreKey,
} from "./rooms";
import { LockedRoom } from "./shell/LockedRoom";
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
 * overwrite each other. The key fingerprint is part of it, so the same slug under a
 * different room key never reads back a board this browser cannot decrypt anyway.
 */
async function storeKeyFor(slug: string, secret: string | undefined): Promise<string> {
  const base = roomStoreKey(slug);
  return secret === undefined ? base : `${base}:${await fingerprint(secret)}`;
}

function storeFor(mode: WorkspaceMode, key: string | null): WorkspaceStore {
  return key === null ? createStore({ mode }) : createWorkspaceStore({ mode, key });
}

/** Rooms, for the visitor's own board only. A #share snapshot never reaches this. */
function startRooms(store: WorkspaceStore, slug: string | null, secret?: string): void {
  configureRooms({
    store,
    // The name on this browser's notes is the name other people see in presence too.
    label: displayName(),
    agent: false, // The header flips this from the WebMCP status once tools register.
    ...(secret === undefined ? {} : { secret }),
    onRoom: (opened: string) => {
      // The invite URL, not the bare join URL: the key lives in the fragment, so dropping
      // it from the address bar would lock this browser out of its own room on reload.
      window.history.replaceState(null, "", inviteUrl(opened));
      // Move persistence to the room key rather than copying the board once: a one-shot
      // copy saves the board as it looked the instant the room opened, and every later
      // edit keeps going to the old key, so reloading the room URL reads back an empty
      // board. rekey is a no-op when the page already booted on this slug, so a
      // hydration still in flight is never clobbered.
      void roomStorageKey(opened).then((next) =>
        (store as { rekey?: (key: string) => Promise<void> }).rekey?.(next),
      );
    },
  });
  if (slug !== null) joinRoom(slug);
}

/** The visitor's own board: tools registered once, demo monitors ticking. */
async function mountWorkspace(root: Root): Promise<void> {
  const mode = readMode();
  const invite = parseInvite(window.location.href);
  if (invite !== null && invite.locked) {
    root.render(
      <StrictMode>
        <LockedRoom />
      </StrictMode>,
    );
    return;
  }
  const slug = invite?.slug ?? null;
  const secret = invite?.secret ?? undefined;
  const store = storeFor(mode, slug === null ? null : await storeKeyFor(slug, secret));
  const controller = new AbortController();
  const statusStore = registerTools(store, controller.signal);
  const stopScheduler = mode === "demo" ? startScheduler(store) : (): void => undefined;
  startRooms(store, slug, secret);
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
    if (workspace === null) void mountWorkspace(reactRoot);
    else mountSnapshot(reactRoot, workspace);
  });
} else {
  void mountWorkspace(reactRoot);
}
