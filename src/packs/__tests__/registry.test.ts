/**
 * The pack registry against the tool contract.
 *
 * The registry names its tools as strings so it can stay a leaf, which means the one
 * thing that can go wrong is drift: a tool added to src/webmcp and forgotten here would
 * be a tool no switch controls. That is what the first test is for.
 */
import { describe, expect, it } from "vitest";
import { TOOL_NAMES } from "../../webmcp/schemas";
import {
  BUILT_IN_PACKS,
  PACK_IDS,
  PACK_TOOL_NAMES,
  defaultEnabled,
  packById,
  packOffText,
  packOfTool,
  packRiskLabel,
} from "../registry";
import { defaultPacksFixture } from "./fixtures";

describe("pack registry", () => {
  it("covers every published tool exactly once", () => {
    const inPacks = [...PACK_TOOL_NAMES].sort();
    const published = [...TOOL_NAMES].sort();

    expect(inPacks).toEqual(published);
    expect(new Set(PACK_TOOL_NAMES).size).toBe(PACK_TOOL_NAMES.length);
  });

  it("publishes 30 tools in six packs", () => {
    expect(TOOL_NAMES).toHaveLength(30);
    expect(BUILT_IN_PACKS).toHaveLength(6);
    expect(BUILT_IN_PACKS.map((pack) => pack.id)).toEqual([...PACK_IDS]);
  });

  it("finds the pack a tool belongs to, and nothing for a tool it does not know", () => {
    expect(packOfTool("approve_draft")?.id).toBe("monitors");
    expect(packOfTool("upsert_dashboard")?.id).toBe("board");
    expect(packOfTool("list_capabilities")?.id).toBe("rooms");
    expect(packOfTool("robot_walk")).toBeNull();
  });

  it("keeps every pack description and risk readable", () => {
    for (const pack of BUILT_IN_PACKS) {
      expect(pack.description.length).toBeGreaterThan(20);
      expect(pack.tools.length).toBeGreaterThan(0);
      expect(packRiskLabel(pack).length).toBeGreaterThan(0);
    }
  });

  it("turns every built-in pack on, alone or in a room (only send and move packs hold back)", () => {
    for (const pack of BUILT_IN_PACKS) {
      expect(defaultEnabled(pack, false)).toBe(true);
      expect(defaultEnabled(pack, true)).toBe(true);
    }
    const sending = { ...packById("board")!, id: "mail", risk: "send" as const };
    expect(defaultEnabled(sending, true)).toBe(false);
    expect(defaultEnabled(sending, false)).toBe(true);
  });

  it("says the same sentence to an agent every time", () => {
    expect(packOffText("monitors")).toBe("The monitors pack is off in this room; ask the host.");
  });

  it("has a fixture board with no pack state on it", () => {
    expect(defaultPacksFixture().packs).toEqual({});
  });
});
