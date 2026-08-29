/**
 * ADAPTER: WebMCP registration. Wired to src/webmcp (A2), with the monitor handlers from
 * A3, the demo seed handler from A5, the two room tools from A10, the four dataset tools
 * from A11 and the three turn tools from A16 merged in, so all 28 tools answer.
 * Registration is async, so the status is a tiny store the header subscribes to.
 */
import { datasetHandlers } from "../../dataset";
import { seedDemoHandler } from "../../demo/sampleWorkspace";
import { monitorHandlers } from "../../monitors";
import { roomHandlers } from "../../rooms";
import { turnHandlers } from "../../turns";
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
    seed_demo_workspace: seedDemoHandler,
  };
}

/**
 * Register every site tool once, for the life of the page.
 * The signal aborts on unload, which unregisters the tools.
 */
export function registerTools(store: WorkspaceStore, signal: AbortSignal): WebmcpStatusStore {
  let current: WebmcpStatus = { available: findModelContext().api !== "none", registered: 0 };
  const listeners = new Set<() => void>();

  const bundle = createWebmcp({ store, handlers: handlersFor() });
  void registerAllTools(bundle.registry, bundle.definitions, { signal }).then((result) => {
    current = { available: result.available, registered: result.registered.length };
    for (const listener of listeners) listener();
  });

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
