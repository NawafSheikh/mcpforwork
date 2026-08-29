/**
 * The encrypted room transport (src/crypto/INTEGRATION.md).
 *
 * Every room this build opens is encrypted, with no setting and no passphrase: a new room
 * mints a secret, the invite link carries it in the fragment, and this wrapper seals what
 * goes out and opens what comes in. The relay sees {v, iv, ct, fp} and nothing else.
 *
 * The key is a promise because deriving it is async and joining a room is not. Sends made
 * before it resolves are queued on the same promise, so they keep their order, and a
 * browser that never gets a key never puts plaintext on the wire.
 *
 * Anything that will not open is counted and dropped. There is no error path on purpose:
 * a wrong key, a tampered byte and a peer from another room are the same event here, and
 * telling them apart would be an oracle.
 */
import { deriveRoomKey, fingerprint, open, seal } from "../crypto";
import type { RoomStatus, RoomTransport } from "./types";

export interface RoomSecrets {
  readonly key: CryptoKey;
  /** Eight hex characters of the secret, shown on the badge and stamped on envelopes. */
  readonly fp: string;
}

/** secret + slug -> the key this room speaks and the fingerprint people compare. */
export async function roomSecrets(secret: string, slug: string): Promise<RoomSecrets> {
  const [key, fp] = await Promise.all([deriveRoomKey(secret, slug), fingerprint(secret)]);
  return { key, fp };
}

export interface SealedTransport extends RoomTransport {
  unreadable(): number;
}

/** Wraps any transport. The inner one never sees a message, only an envelope. */
export function sealedTransport(inner: RoomTransport, secrets: Promise<RoomSecrets>): SealedTransport {
  let unreadable = 0;
  const ready = secrets.catch(() => null);

  const relay =
    (listener: (message: unknown) => void) =>
    (raw: unknown): void => {
      void ready.then(async (loaded) => {
        if (loaded === null) return;
        const opened = await open(loaded.key, raw, { slug: inner.slug, fp: loaded.fp });
        if (opened === null) {
          unreadable += 1;
          return;
        }
        listener(opened);
      });
    };

  return {
    ...inner,
    connect: () => inner.connect(),
    close: () => inner.close(),
    status: (): RoomStatus => inner.status(),
    onStatus: (listener) => inner.onStatus(listener),
    send(message: unknown): void {
      void ready.then(async (loaded) => {
        if (loaded === null) return;
        inner.send(await seal(loaded.key, message, { slug: inner.slug, fp: loaded.fp }));
      });
    },
    onMessage: (listener) => inner.onMessage(relay(listener)),
    unreadable: () => unreadable,
  };
}
