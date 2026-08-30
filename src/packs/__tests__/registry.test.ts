/**
 * The pack registry against the tool contract.
 *
 * The registry names its tools as strings so it can stay a leaf, which means the one
 * thing that can go wrong is drift: a tool added to src/webmcp and forgotten here would
 * be a tool no switch controls. That is what the first test is for.
 */
import { describe, expect, it } from "vitest";
import { TOOL_NAMES } from "../../webmcp/schemas";
import type { PackDefinition } from "../registry";
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

  it("publishes 41 tools in eight packs", () => {
    expect(TOOL_NAMES).toHaveLength(41);
    expect(BUILT_IN_PACKS).toHaveLength(8);
    expect(BUILT_IN_PACKS.map((pack) => pack.id)).toEqual([...PACK_IDS]);
  });

  it("gives the pack that can spend money the risk that keeps it off in a room", () => {
    // Found on 30 Aug: the comment above BUILT_IN_PACKS said "only monitors is send",
    // its own description said it "can act on the outside", docs/TOOLS.md documented it
    // as send, and the code said write. defaultEnabled only holds back send and move, so
    // the one pack that can approve a payment was on by default in every room.
    const approvals = packOfTool("approve_draft");
    expect(approvals?.id).toBe("monitors");
    expect(approvals?.risk).toBe("send");
    expect(defaultEnabled(approvals as PackDefinition, true)).toBe(false);
    expect(defaultEnabled(approvals as PackDefinition, false)).toBe(true);
  });

  it("keeps every pack that cannot act outside this page on in a room", () => {
    for (const pack of BUILT_IN_PACKS) {
      if (pack.risk === "send" || pack.risk === "move") continue;
      expect(defaultEnabled(pack, true)).toBe(true);
    }
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

  /**
   * This assertion used to be written against a pack invented in the test:
   *
   *   const sending = { ...packById("monitors")!, risk: "send" as const };
   *   expect(defaultEnabled(sending, true)).toBe(false);
   *
   * which is the rule restated, not the shipped packs checked. It passed happily for days
   * while the real monitors pack was `write`, so the one pack that can approve a payment
   * defaulted ON in every room. The synthetic pack is gone: this now reads the risk each
   * pack actually declares.
   */
  it("turns every pack on for one person alone", () => {
    for (const pack of BUILT_IN_PACKS) {
      expect(defaultEnabled(pack, false)).toBe(true);
    }
  });

  it("holds back exactly the packs that can act outside this page once others are here", () => {
    const held = BUILT_IN_PACKS.filter((pack) => !defaultEnabled(pack, true)).map((p) => p.id);
    const risky = BUILT_IN_PACKS.filter(
      (pack) => pack.risk === "send" || pack.risk === "move",
    ).map((p) => p.id);

    expect(held).toEqual(risky);
    // Named, so removing the guard from monitors has to be a deliberate edit here too.
    expect(held).toContain("monitors");
  });

  it("says the same sentence to an agent every time", () => {
    expect(packOffText("monitors")).toBe("The monitors pack is off in this room; ask the host.");
  });

  it("has a fixture board with no pack state on it", () => {
    expect(defaultPacksFixture().packs).toEqual({});
  });
});
