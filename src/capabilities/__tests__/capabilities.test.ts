/**
 * Capability cards: publish one through the tool, read it back through the other, and
 * check that nothing hostile survives the trip in from a peer.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceStore, type PersistentWorkspaceStore } from "../../store";
import { createToolRegistry } from "../../webmcp/registry";
import { workspaceHandlers } from "../../webmcp/handlers";
import { TOOL_NAMES } from "../../webmcp/schemas";
import { annotationsFor } from "../../webmcp/annotations";
import { LIMITS, type Capability } from "../../types";
import { capabilityHandlers, capabilityToolDescriptions } from "../tools";
import { capabilityKey, coerceCapability } from "../coerce";
import { capabilityLine, listCapabilities, publishCapability } from "../state";

const AT = "2026-08-29T10:00:00.000Z";

let live: PersistentWorkspaceStore | null = null;

afterEach(() => {
  live?.dispose();
  live = null;
});

function registry() {
  live = createWorkspaceStore({ mode: "local", persist: false });
  return {
    store: live,
    tools: createToolRegistry({
      store: live,
      handlers: { ...workspaceHandlers, ...capabilityHandlers },
    }),
  };
}

const card = (name: string, kind: Capability["owner"]["kind"] = "agent"): Capability => ({
  owner: { kind, name },
  packs: ["board", "notes"],
  local: ["Fabric CLI"],
  knows: ["Fabric lakehouse owner"],
  updatedAt: AT,
});

describe("capability tools", () => {
  it("are part of the published contract and read only where they should be", () => {
    expect(TOOL_NAMES).toContain("publish_capabilities");
    expect(TOOL_NAMES).toContain("list_capabilities");
    expect(annotationsFor("list_capabilities")).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(annotationsFor("publish_capabilities").readOnlyHint).toBe(false);
  });

  it("tells an agent to look before it asks", () => {
    expect(capabilityToolDescriptions.list_capabilities).toContain(
      "find who has access to a system before asking for it",
    );
    for (const text of Object.values(capabilityToolDescriptions)) {
      expect(text.length).toBeLessThanOrEqual(LIMITS.toolDescriptionChars);
    }
  });

  it("round trips: publish then list", async () => {
    const { store, tools } = registry();

    const published = await tools.call("publish_capabilities", {
      caller: "maria-agent",
      local: ["Fabric CLI", "Teams desktop"],
      knows: ["D365 finance"],
    });
    const listed = await tools.call("list_capabilities", { caller: "ana-agent" });

    expect(published).toContain("maria-agent");
    const rows = JSON.parse(listed) as { capabilities: readonly Record<string, unknown>[] };
    expect(rows.capabilities).toHaveLength(1);
    expect(rows.capabilities[0]).toMatchObject({
      name: "maria-agent",
      kind: "agent",
      local: ["Fabric CLI", "Teams desktop"],
      knows: ["D365 finance"],
    });
    // The site packs are measured, never declared: every pack is on for a local board.
    expect(rows.capabilities[0]?.packs).toEqual([
      "board",
      "workspaces",
      "datasets",
      "notes",
      "turns",
      "monitors",
      "rooms",
    ]);
    expect(Object.keys(store.get().capabilities ?? {})).toEqual(["maria-agent"]);
  });

  it("replaces the card of the same owner instead of adding a second one", async () => {
    const { store, tools } = registry();
    await tools.call("publish_capabilities", { caller: "maria-agent", knows: ["first"] });
    await tools.call("publish_capabilities", { caller: "maria-agent", knows: ["second"] });

    const cards = listCapabilities(store.get());
    expect(cards).toHaveLength(1);
    expect(cards[0]?.knows).toEqual(["second"]);
  });

  it("lets a person publish a card for themselves, and a robot be published by name", async () => {
    const { store, tools } = registry();
    await tools.call("publish_capabilities", {
      caller: "maria-agent",
      owner: { kind: "robot", name: "Spot" },
      local: ["walk", "turn"],
    });

    const spot = listCapabilities(store.get())[0];
    expect(spot?.owner).toEqual({ kind: "robot", name: "Spot" });
  });

  it("tells an agent what to do when nobody has published anything", async () => {
    const { tools } = registry();
    expect(await tools.call("list_capabilities", {})).toContain("publish_capabilities");
  });
});

describe("capability state", () => {
  it("keeps the newest card first and caps how many it holds", () => {
    let ws = createWorkspaceStore({ mode: "local", persist: false }).get();
    for (let index = 0; index < LIMITS.maxCapabilities + 5; index += 1) {
      ws = publishCapability(ws, {
        ...card(`agent-${index}`),
        updatedAt: new Date(Date.parse(AT) + index * 1000).toISOString(),
      });
    }
    const cards = listCapabilities(ws);
    expect(cards).toHaveLength(LIMITS.maxCapabilities);
    expect(cards[0]?.owner.name).toBe(`agent-${LIMITS.maxCapabilities + 4}`);
  });

  it("says the line a rail can print", () => {
    expect(capabilityLine(card("Maria", "person"))).toBe(
      "Maria (person): board, notes; Fabric CLI, Fabric lakehouse owner",
    );
  });
});

describe("coercing a card from a peer", () => {
  it("keeps a good card and drops a nameless or prototype-shaped one", () => {
    expect(coerceCapability(card("Maria"), AT)?.owner.name).toBe("Maria");
    expect(coerceCapability({ owner: { kind: "person" } }, AT)).toBeNull();
    expect(coerceCapability({ owner: { kind: "person", name: "__proto__" } }, AT)).toBeNull();
    expect(coerceCapability("not a card", AT)).toBeNull();
  });

  it("caps the lists and falls back to agent for an unknown kind", () => {
    const wide = coerceCapability(
      {
        owner: { kind: "alien", name: "  Maria  " },
        local: Array.from({ length: 40 }, (_item, index) => `tool-${index}`),
        knows: [""],
        packs: ["board"],
      },
      AT,
    );
    expect(wide?.owner).toEqual({ kind: "agent", name: "Maria" });
    expect(wide?.local).toHaveLength(LIMITS.maxCapabilityLines);
    expect(wide?.knows).toEqual([]);
    expect(wide?.updatedAt).toBe(AT);
  });

  it("keys a card by the owner name, trimmed", () => {
    expect(capabilityKey("  maria-agent ")).toBe("maria-agent");
  });
});
