/**
 * Bootstrap: one store, one tool registration, one root.
 * Registration happens at module scope so StrictMode remounts cannot register twice.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createStore } from "./shell/adapters/store";
import { startScheduler } from "./shell/adapters/monitors";
import { registerTools } from "./shell/adapters/webmcp";
import { ShellProvider } from "./shell/context";
import type { WorkspaceMode } from "./types";
import "./styles/app.css";

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

ensureFavicon();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("root element missing");

createRoot(rootElement).render(
  <StrictMode>
    <ShellProvider store={store} statusStore={statusStore}>
      <App />
    </ShellProvider>
  </StrictMode>,
);
