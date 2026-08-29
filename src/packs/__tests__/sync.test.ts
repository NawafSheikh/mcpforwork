/**
 * The two new entity kinds on the wire: a pack switch and a capability card.
 *
 * Both behave like every other entity in a room: derived by reference inequality, coerced
 * on the way in, last writer wins per key, and deleted by a null value. The room's own
 * suite covers the engine; this one covers the two kinds A20 added to it.
 */
import { describe, expect, it } from "vitest";
import { applyPatches } from "../../rooms/apply";
import { derivePatches, emptyLike, fullPatches } from "../../rooms/diff";
import { PATCH_KINDS } from "../../rooms/types";
import { coercePatch } from "../../rooms/wire";
import { emptyWorkspace } from "../../store/createStore";
import type { Workspace } from "../../types";
import { publishCapability } from "../../capabilities/state";
import { coercePackState } from "../coerce";
import { setPackState } from "../state";

const AT = "2026-08-29T10:00:00.000Z";
const LATER = "2026-08-29T10:05:00.000Z";

const board = (): Workspace => emptyWorkspace("demo", AT);

const withCard = (ws: Workspace, name: string, knows: readonly string[]): Workspace =>
  publishCapability(ws, {
    owner: { kind: "agent", name },
    packs: ["board"],
    local: [],
    knows,
    updatedAt: AT,
  });

describe("pack and capability patches", () => {
  it("are kinds the wire accepts", () => {
    expect(PATCH_KINDS).toContain("pack");
    expect(PATCH_KINDS).toContain("capability");
    expect(coercePatch({ kind: "pack", key: "monitors", value: {}, origin: "aaa" }, AT)?.kind).toBe("pack");
  });

  it("carry a switch to the other browser", () => {
    const before = board();
    const after = setPackState(before, { id: "monitors", enabled: false, by: "Ana", at: AT });

    const patches = derivePatches(before, after, "aaa", AT);
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({ kind: "pack", key: "monitors" });

    const landed = applyPatches(board(), patches, {});
    expect(landed.applied).toBe(1);
    expect(landed.ws.packs?.monitors).toEqual({
      id: "monitors",
      enabled: false,
      changedBy: "Ana",
      changedAt: AT,
    });
  });

  it("carry a capability card to the other browser", () => {
    const before = board();
    const after = withCard(before, "maria-agent", ["Fabric lakehouse owner"]);

    const patches = derivePatches(before, after, "aaa", AT);
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({ kind: "capability", key: "maria-agent" });

    const landed = applyPatches(board(), patches, {});
    expect(landed.ws.capabilities?.["maria-agent"]?.knows).toEqual(["Fabric lakehouse owner"]);
  });

  it("lets the later writer win and a null value remove the entity", () => {
    const on = setPackState(board(), { id: "notes", enabled: true, by: "Ana", at: AT });
    const off = setPackState(on, { id: "notes", enabled: false, by: "Ben", at: LATER });

    const first = applyPatches(board(), derivePatches(board(), on, "aaa", AT), {});
    const second = applyPatches(first.ws, derivePatches(on, off, "bbb", LATER), first.clock);
    expect(second.ws.packs?.notes?.enabled).toBe(false);

    const stale = applyPatches(second.ws, derivePatches(board(), on, "aaa", AT), second.clock);
    expect(stale.stale).toBe(1);
    expect(stale.ws.packs?.notes?.enabled).toBe(false);

    const removed = applyPatches(
      second.ws,
      [{ kind: "pack", key: "notes", value: null, at: "2026-08-29T11:00:00.000Z", origin: "bbb" }],
      second.clock,
    );
    expect(removed.ws.packs?.notes).toBeUndefined();
  });

  it("drops a switch for a pack this build does not know", () => {
    expect(coercePackState({ id: "teleport", enabled: false }, AT)).toBeNull();
    expect(coercePackState({ id: "board" }, AT)).toBeNull();
    expect(coercePackState({ id: "board", enabled: true }, AT)?.changedBy).toBe("Someone");

    const landed = applyPatches(
      board(),
      [{ kind: "pack", key: "teleport", value: { id: "teleport", enabled: true }, at: AT, origin: "zzz" }],
      {},
    );
    expect(landed.dropped).toBe(1);
    expect(landed.ws.packs).toEqual({});
  });

  it("gives a late joiner both kinds in the opening snapshot", () => {
    const seeded = withCard(
      setPackState(board(), { id: "monitors", enabled: false, by: "Ana", at: AT }),
      "maria-agent",
      ["D365 finance"],
    );

    expect(emptyLike(seeded).packs).toEqual({});
    expect(emptyLike(seeded).capabilities).toEqual({});

    const kinds = fullPatches(seeded, "aaa", AT).map((patch) => patch.kind);
    expect(kinds).toContain("pack");
    expect(kinds).toContain("capability");
  });
});
