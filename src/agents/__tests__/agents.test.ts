/**
 * Agent identity: the rule that stops a room full of Codexes.
 *
 * What is under test is the naming, not the card: a name already taken gets a number, a
 * repeat claim from the same page is the same agent, a rename leaves no ghost card, and a
 * bare vendor name is granted with the reason it is a poor one rather than refused.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { emptyWorkspace } from "../../store";
import { publishCapability } from "../../capabilities/state";
import type { Capability, Workspace } from "../../types";
import { agentNames, grantName, heldName, isBareVendorName, resetIdentity } from "../identity";
import { agentHandlers } from "../tools";

const card = (name: string, kind: Capability["owner"]["kind"] = "agent"): Capability => ({
  owner: { kind, name },
  packs: [],
  local: [],
  knows: [],
  updatedAt: "2026-08-30T09:00:00.000Z",
});

const board = (...names: string[]): Workspace =>
  names.reduce<Workspace>((ws, name) => publishCapability(ws, card(name)), emptyWorkspace("local"));

describe("granting a name", () => {
  it("gives a free name as asked", () => {
    expect(grantName(board(), "Nawaf's Codex", null)).toBe("Nawaf's Codex");
  });

  it("numbers a name somebody else already took", () => {
    expect(grantName(board("Codex"), "Codex", null)).toBe("Codex 2");
    expect(grantName(board("Codex", "Codex 2"), "Codex", null)).toBe("Codex 3");
  });

  it("is not a collision with itself, so a repeat claim keeps the name", () => {
    expect(grantName(board("Codex"), "Codex", "Codex")).toBe("Codex");
    expect(grantName(board("Codex"), "codex", "Codex")).toBe("Codex");
  });

  it("ignores people, because a person and an agent can share a name", () => {
    const ws = publishCapability(emptyWorkspace("local"), card("Nawaf", "person"));
    expect(agentNames(ws)).toEqual([]);
    expect(grantName(ws, "Nawaf", null)).toBe("Nawaf");
  });

  it("knows which names say nothing about whose agent it is", () => {
    expect(isBareVendorName("Codex")).toBe(true);
    expect(isBareVendorName(" chatgpt ")).toBe(true);
    expect(isBareVendorName("Nawaf's Codex")).toBe(false);
  });
});

describe("join_as", () => {
  beforeEach(() => resetIdentity());

  it("hands back the exact caller string to use, and publishes the card", () => {
    const out = agentHandlers.join_as({ name: "Nawaf's Codex", of: "Nawaf" }, emptyWorkspace("local"));

    expect(out.result).toContain('You are "Nawaf\'s Codex"');
    expect(out.result).toContain('caller: "Nawaf\'s Codex"');
    expect(agentNames(out.next as Workspace)).toEqual(["Nawaf's Codex"]);
    expect(heldName()).toBe("Nawaf's Codex");
  });

  it("says so when the name was taken, and names who else is here", () => {
    const out = agentHandlers.join_as({ name: "Codex" }, board("Codex"));

    expect(out.result).toContain('you are "Codex 2"');
    expect(out.result).toContain("Also here: Codex");
  });

  it("grants a bare vendor name but says why it is a bad one", () => {
    const out = agentHandlers.join_as({ name: "Codex" }, emptyWorkspace("local"));

    expect(out.result).toContain('You are "Codex"');
    expect(out.result).toContain("whose you are");
  });

  it("renames without leaving the old card behind", () => {
    const first = agentHandlers.join_as({ name: "Codex" }, emptyWorkspace("local"));
    const second = agentHandlers.join_as({ name: "Nawaf's Codex" }, first.next as Workspace);

    expect(agentNames(second.next as Workspace)).toEqual(["Nawaf's Codex"]);
  });

  it("is idempotent, so claiming the same name twice is still one agent", () => {
    const first = agentHandlers.join_as({ name: "Ana's Claude" }, emptyWorkspace("local"));
    const second = agentHandlers.join_as({ name: "Ana's Claude" }, first.next as Workspace);

    expect(agentNames(second.next as Workspace)).toEqual(["Ana's Claude"]);
    expect(second.result).toContain('You are "Ana\'s Claude"');
    expect(second.result).toContain("only agent here");
  });

  it("keeps what the agent said it is doing on the card", () => {
    const out = agentHandlers.join_as(
      { name: "Ben's Codex", of: "Ben", doing: "the Android build" },
      emptyWorkspace("local"),
    );
    const cards = Object.values((out.next as Workspace).capabilities ?? {});

    expect(cards[0]?.knows).toEqual(["agent of Ben", "the Android build"]);
  });
});
