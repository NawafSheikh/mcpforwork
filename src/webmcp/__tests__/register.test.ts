import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceStore } from "../../store/createStore";
import { workspaceHandlers } from "../handlers";
import { createToolRegistry } from "../registry";
import { createToolDefinitions } from "../definitions";
import { findModelContext, registerAllTools, type ModelContextLike } from "../register";

interface FakeContext extends ModelContextLike {
  readonly tools: Map<string, { annotations: Record<string, unknown> }>;
  fire(): void;
}

function fakeContext(): FakeContext {
  const tools = new Map<string, { annotations: Record<string, unknown> }>();
  const listeners = new Set<() => void>();
  return {
    tools,
    registerTool(tool) {
      tools.set(tool.name, { annotations: tool.annotations });
      return () => tools.delete(tool.name);
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    fire() {
      for (const listener of listeners) listener();
    },
  };
}

const bundle = () => {
  const store = createWorkspaceStore({ mode: "local", persist: false });
  const registry = createToolRegistry({ store, handlers: workspaceHandlers });
  return { registry, definitions: createToolDefinitions(registry) };
};

afterEach(() => {
  Reflect.deleteProperty(document, "modelContext");
  Reflect.deleteProperty(navigator, "modelContext");
});

describe("registerAllTools", () => {
  it("degrades gracefully when no model context exists", async () => {
    const { registry, definitions } = bundle();
    const result = await registerAllTools(registry, definitions);

    expect(result).toEqual({ available: false, registered: [], api: "none" });
    expect(findModelContext().api).toBe("none");
  });

  it("registers all 43 tools on document.modelContext", async () => {
    const context = fakeContext();
    Object.defineProperty(document, "modelContext", { value: context, configurable: true });
    const { registry, definitions } = bundle();
    const result = await registerAllTools(registry, definitions);

    expect(result.api).toBe("document");
    expect(result.available).toBe(true);
    expect(result.registered).toHaveLength(43);
    expect(context.tools.get("get_workspace")?.annotations).toMatchObject({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
  });

  it("falls back to navigator.modelContext and unregisters on abort", async () => {
    const context = fakeContext();
    Object.defineProperty(navigator, "modelContext", { value: context, configurable: true });
    const controller = new AbortController();
    const onToolsChanged = vi.fn();
    const { registry, definitions } = bundle();
    const result = await registerAllTools(registry, definitions, {
      signal: controller.signal,
      onToolsChanged,
    });

    expect(result.api).toBe("navigator");
    expect(context.tools.size).toBe(43);
    context.fire();
    expect(onToolsChanged).toHaveBeenCalledWith(result.registered);

    controller.abort();
    expect(context.tools.size).toBe(0);
    context.fire();
    expect(onToolsChanged).toHaveBeenCalledTimes(1);
  });
});
