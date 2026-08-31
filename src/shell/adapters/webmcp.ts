/**
 * ADAPTER: WebMCP registration. Wired to src/webmcp (A2), with the monitor handlers from
 * A3, the two room tools from A10, the four dataset tools from A11, the three turn tools
 * from A16, the two capability tools from A20 and the five workspace tools merged in,
 * so all 34 tools answer. The pack controller from A20 goes to both halves: the
 * registry refuses a call to a switched-off pack, and registration follows the switches.
 * Registration is async, so the status is a tiny store the header subscribes to.
 */
import { capabilityHandlers } from "../../capabilities";
import { datasetHandlers } from "../../dataset";
import { createPackController } from "../../packs";
import { monitorHandlers } from "../../monitors";
import { roomHandlers } from "../../rooms";
import { turnHandlers } from "../../turns";
import { workspaceToolHandlers } from "../../workspaces/tools";
import { agentHandlers } from "../../agents/tools";
import { loopHandlers } from "../../loops/tools";
import { purposeHandlers } from "../../purpose/tools";
import { decisionHandlers } from "../../decisions/tools";
import { sessionHandlers } from "../../sessions/tools";
import { createWebmcp, findModelContext, registerAllTools } from "../../webmcp";
import type { HandlerMap } from "../../webmcp";
import type { WorkspaceStore } from "../../types";

export interface WebmcpStatus {
  readonly available: boolean;
  readonly registered: number;
}

export interface WebmcpStatusStore {
  get(): WebmcpStatus;
  subscribe(listener: () => void): () => void;
}

function handlersFor(): HandlerMap {
  return {
    ...(monitorHandlers as HandlerMap),
    ...roomHandlers,
    ...datasetHandlers,
    ...turnHandlers,
    ...capabilityHandlers,
    ...(workspaceToolHandlers as unknown as HandlerMap),
    ...(agentHandlers as unknown as HandlerMap),
    ...(loopHandlers as unknown as HandlerMap),
    ...(purposeHandlers as unknown as HandlerMap),
    ...(decisionHandlers as unknown as HandlerMap),
    ...(sessionHandlers as unknown as HandlerMap),
  };
}

/**
 * Register every site tool once, for the life of the page.
 * The signal aborts on unload, which unregisters the tools.
 */
export function registerTools(store: WorkspaceStore, signal: AbortSignal): WebmcpStatusStore {
  let current: WebmcpStatus = { available: findModelContext().api !== "none", registered: 0 };
  const listeners = new Set<() => void>();

  const packs = createPackController(store);
  const bundle = createWebmcp({ store, handlers: handlersFor(), packs });
  const announce = (available: boolean, registered: number): void => {
    current = { available, registered };
    for (const listener of [...listeners]) listener();
  };
  void registerAllTools(bundle.registry, bundle.definitions, {
    signal,
    packs,
    // Fires on the first pass and after every pack switch, so the pill stays honest.
    onRegistered: (names) => announce(true, names.length),
  }).then((result) => announce(result.available, result.registered.length));

  return {
    get: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
