import { describe, expect, it } from "vitest";
import { createWorkspaceStore } from "../../store/createStore";
import { workspaceHandlers } from "../handlers";
import { createToolRegistry, type HandlerMap } from "../registry";
import { createToolDefinitions } from "../definitions";
import { jsonSchemas } from "../jsonSchemas";
import { LIMITS } from "../../types";

function descriptions(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) descriptions(item, found);
    return found;
  }
  if (typeof node !== "object" || node === null) return found;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "description" && typeof value === "string") found.push(value);
    else descriptions(value, found);
  }
  return found;
}

const setup = (extra?: HandlerMap, maxCallsPerMinute?: number) => {
  const store = createWorkspaceStore({ mode: "demo", persist: false });
  const registry = createToolRegistry({
    store,
    handlers: { ...workspaceHandlers, ...extra },
    maxCallsPerMinute,
  });
  return { store, registry };
};

describe("tool registry", () => {
  it("returns a friendly validation error naming the failing paths", async () => {
    const { registry, store } = setup();
    const result = await registry.call("create_category", { name: "" });

    expect(result).toContain("Invalid input for create_category");
    expect(result).toContain("name:");
    expect(store.get().categories).toEqual({});
  });

  it("refuses politely once the rate limit is hit", async () => {
    const { registry } = setup(undefined, 2);
    await registry.call("create_category", { name: "One" });
    await registry.call("create_category", { name: "Two" });
    const third = await registry.call("create_category", { name: "Three" });

    expect(third).toContain("Rate limit");
    expect(third).toContain("workspace is unchanged");
  });

  it("appends one audit event per call, good or bad", async () => {
    const { registry, store } = setup();
    await registry.call("create_category", { name: "Invoices", description: "AR" });
    await registry.call("create_category", { name: "" });

    const audit = store.get().audit;
    expect(audit).toHaveLength(2);
    expect(audit[0]).toMatchObject({ actor: "agent", tool: "create_category", ok: true });
    expect(audit[0]?.argsHash).toMatch(/^[0-9a-f]{8}$/);
    expect(audit[0]?.argsPreview).toContain("Invoices");
    expect(audit[1]?.ok).toBe(false);
    expect(store.get().categories.Invoices?.description).toBe("AR");
  });

  it("truncates output at LIMITS.toolOutputChars", async () => {
    const { registry } = setup({ get_workspace: () => ({ result: "x".repeat(5000) }) });
    const result = await registry.call("get_workspace", {});

    expect(result).toHaveLength(LIMITS.toolOutputChars);
    expect(result.endsWith("...")).toBe(true);
  });

  it("answers not wired yet for tools another module owns", async () => {
    const { registry } = setup();
    const result = await registry.call("report_monitor_run", { monitorId: "m1" });

    expect(result).toContain("not wired yet");
    expect(registry.wired()).not.toContain("report_monitor_run");
    expect(registry.names()).toHaveLength(24);
  });

  it("names an unknown tool instead of throwing", async () => {
    const { registry } = setup();
    await expect(registry.call("nope", {})).resolves.toContain("Unknown tool");
  });

  it("never throws when a handler blows up", async () => {
    const { registry, store } = setup({
      get_dashboard: () => {
        throw new Error("boom");
      },
    });
    const result = await registry.call("get_dashboard", { category: "Invoices" });

    expect(result).toContain("failed: boom");
    expect(store.get().audit[0]?.ok).toBe(false);
  });

  it("builds every definition with a legal description and annotations", () => {
    const { registry } = setup();
    const definitions = createToolDefinitions(registry);

    expect(definitions).toHaveLength(24);
    for (const definition of definitions) {
      expect(definition.description.length).toBeLessThanOrEqual(LIMITS.toolDescriptionChars);
      expect(definition.inputSchema).toHaveProperty("type", "object");
      expect(definition.annotations).toBeDefined();
    }
    const readTool = definitions.find((d) => d.name === "get_workspace");
    expect(readTool?.annotations).toMatchObject({ readOnlyHint: true, untrustedContentHint: true });
    const writeTool = definitions.find((d) => d.name === "create_category");
    expect(writeTool?.annotations).toMatchObject({ readOnlyHint: false, untrustedContentHint: false });
  });

  it("keeps every parameter description under the WebMCP limit", () => {
    const all = descriptions(jsonSchemas);
    expect(all.length).toBeGreaterThan(30);
    for (const description of all) {
      expect(description.length).toBeLessThanOrEqual(LIMITS.paramDescriptionChars);
    }
  });

  it("routes a definition execute through the registry", async () => {
    const { registry, store } = setup();
    const definitions = createToolDefinitions(registry);
    const create = definitions.find((d) => d.name === "create_category");
    const said = await create?.execute({ name: "Support" }, {});

    expect(said).toContain("Category Support ready");
    expect(store.get().categories.Support).toBeDefined();
  });
});
