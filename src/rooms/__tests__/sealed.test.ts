/**
 * An encrypted room, end to end, over the mock relay.
 *
 * Two browsers holding the same invite link sync exactly as they always did. A third
 * browser on the same slug with a different key sees ciphertext: nothing it receives is
 * ever applied to its board, and nothing it sends reaches theirs. The relay in the middle
 * carries {v, iv, ct, fp} and could not read a category name if it wanted to.
 */
import { describe, expect, it } from "vitest";
import { generateRoomSecret, isEnvelope } from "../../crypto";
import { createMemoryHub } from "../transport";
import { roomSecrets, sealedTransport } from "../sealed";
import { startRoomSync, type RoomRuntime } from "../sync";
import { createWorkspaceStore, type PersistentWorkspaceStore } from "../../store";
import type { Category, Workspace } from "../../types";

const SLUG = "sealedroom1";
const T1 = "2026-08-29T10:00:00.000Z";

/** Let the seal and open promises run. Everything here is async by construction. */
async function settle(times = 30): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function store(): PersistentWorkspaceStore {
  return createWorkspaceStore({ mode: "local", persist: false });
}

const category = (name: string): Category => ({ name, description: `${name} board`, createdAt: T1 });

const withCategory =
  (name: string) =>
  (ws: Workspace): Workspace => ({ ...ws, categories: { ...ws.categories, [name]: category(name) } });

interface Peer {
  readonly store: PersistentWorkspaceStore;
  readonly room: RoomRuntime;
}

function peer(
  hub: ReturnType<typeof createMemoryHub>,
  clientId: string,
  secret: string,
): Peer {
  const workspace = store();
  const room = startRoomSync({
    store: workspace,
    slug: SLUG,
    clientId,
    transport: sealedTransport(hub.transport(SLUG), roomSecrets(secret, SLUG)),
  });
  return { store: workspace, room };
}

describe("an encrypted room", () => {
  it("syncs two browsers holding the same key", async () => {
    const hub = createMemoryHub();
    const secret = generateRoomSecret();
    const a = peer(hub, "aaa1", secret);
    const b = peer(hub, "bbb2", secret);
    await settle();
    await a.store.update(withCategory("Invoices"));
    a.room.flush();
    await settle();
    expect(b.store.get().categories.Invoices?.description).toBe("Invoices board");
    a.room.stop();
    b.room.stop();
    a.store.dispose();
    b.store.dispose();
  });

  it("puts nothing but an envelope on the wire", async () => {
    const hub = createMemoryHub();
    const secret = generateRoomSecret();
    const a = peer(hub, "aaa1", secret);
    await settle();
    await a.store.update(withCategory("Payroll"));
    a.room.flush();
    await settle();
    expect(hub.sent.length).toBeGreaterThan(0);
    for (const message of hub.sent) expect(isEnvelope(message)).toBe(true);
    expect(JSON.stringify(hub.sent)).not.toContain("Payroll");
    a.room.stop();
    a.store.dispose();
  });

  it("applies nothing from a peer holding a different key", async () => {
    const hub = createMemoryHub();
    const ours = generateRoomSecret();
    const theirs = generateRoomSecret();
    const a = peer(hub, "aaa1", ours);
    const b = peer(hub, "bbb2", ours);
    const stranger = peer(hub, "ccc3", theirs);
    await settle();
    await a.store.update(withCategory("Invoices"));
    a.room.flush();
    await stranger.store.update(withCategory("Trojan"));
    stranger.room.flush();
    await settle();
    expect(b.store.get().categories.Invoices?.name).toBe("Invoices");
    expect(stranger.store.get().categories.Invoices).toBeUndefined();
    expect(a.store.get().categories.Trojan).toBeUndefined();
    expect(b.store.get().categories.Trojan).toBeUndefined();
    expect(stranger.room.unreadable()).toBeGreaterThan(0);
    a.room.stop();
    b.room.stop();
    stranger.room.stop();
    a.store.dispose();
    b.store.dispose();
    stranger.store.dispose();
  });
});
