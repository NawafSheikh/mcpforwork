# Encrypting the room transport (A17 -> src/rooms)

Nothing to understand or type: a new room mints a secret, the invite carries it, encryption is on. No setting, no passphrase, no join approval.

```ts
import { deriveRoomKey, open, seal } from "../crypto";
import type { RoomMessage, RoomTransport } from "./types";

/** Wraps createRoomTransport(slug); pass it as startRoomSync({ transport }). */
export function sealedTransport(inner: RoomTransport, key: CryptoKey, fp: string): RoomTransport {
  const ctx = { slug: inner.slug, fp };
  let unreadable = 0; // "N messages this browser could not read", beside the presence chip
  const relay = (listener: (m: RoomMessage) => void) => (raw: unknown) =>
    void open(key, raw, ctx).then((m) => (m === null ? (unreadable += 1) : listener(coerceMessage(m, new Date()) as RoomMessage)));
  return {
    ...inner,
    send: (m: RoomMessage) => void seal(key, m, ctx).then((e) => inner.send(e as never)),
    onMessage: (listener) => inner.onMessage(relay(listener)),
  };
}
```

`coerceMessage` (wire.ts) runs on the opened object, never on the envelope, and the seam
needs one widening: `RoomTransport.send/onMessage` take `unknown`, or `RoomMessage` gains
`{ t: "enc" } & Envelope`. Four wiring points:

1. **Join** `parseInvite(location.href)`; when `.locked`, show `LOCKED_ROOM_MESSAGE` and never call `joinRoom`.
2. **Create** `generateRoomSecret()` -> `deriveRoomKey(secret, slug)`; `inviteUrl(slug)` returns `buildInviteUrl(location.href, slug, secret, "write")`.
3. **Presence** `lockBadgeLabel(await fingerprint(secret))` next to `presenceLabel(usePresence())`, title `ENCRYPTED_BADGE`.
4. **Persistence** key the store `roomStoreKey(slug) + ":" + fp` inside `configureRooms.onRoom`, so a keyed room never shares IndexedDB with the same slug unkeyed.
