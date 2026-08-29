/**
 * The degraded fallback: a room that never leaves this browser.
 *
 * BroadcastChannel reaches every tab and window of the SAME browser profile on the same
 * origin. It does not reach another profile, another browser or another machine, whatever
 * a demo script might wish. It is here so that a room still visibly works with no relay
 * configured at all, and so the honest label in the UI is "this browser only".
 */
import type { RoomStatus, RoomTransport } from "./types";

export function channelName(slug: string): string {
  return `mfw-room-${slug}`;
}

type ChannelFactory = (name: string) => BroadcastChannel;

export interface BroadcastTransportOptions {
  readonly channelFactory?: ChannelFactory;
}

export function hasBroadcastChannel(): boolean {
  return typeof (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel === "function";
}

export function createBroadcastTransport(
  slug: string,
  options: BroadcastTransportOptions = {},
): RoomTransport {
  const messageListeners = new Set<(message: unknown) => void>();
  const statusListeners = new Set<(status: RoomStatus) => void>();
  const factory = options.channelFactory ?? ((name: string) => new BroadcastChannel(name));

  let channel: BroadcastChannel | null = null;
  let status: RoomStatus = "idle";

  const setStatus = (next: RoomStatus): void => {
    if (next === status) return;
    status = next;
    for (const listener of [...statusListeners]) listener(next);
  };

  return {
    kind: "broadcast",
    slug,
    connect(): void {
      if (channel !== null) return;
      try {
        channel = factory(channelName(slug));
      } catch {
        setStatus("error");
        return;
      }
      // Raw on purpose: the payload may be a sealed envelope, which only the sync engine's
      // transport wrapper can open. Coercion into a RoomMessage happens after that.
      channel.onmessage = (event: MessageEvent): void => {
        for (const listener of [...messageListeners]) listener(event.data);
      };
      setStatus("open");
    },
    status: () => status,
    send(message: unknown): void {
      try {
        channel?.postMessage(JSON.parse(JSON.stringify(message)) as unknown);
      } catch {
        setStatus("error");
      }
    },
    close(): void {
      try {
        channel?.close();
      } catch {
        // Already gone.
      }
      channel = null;
      setStatus("closed");
    },
    onMessage(listener: (message: unknown) => void): () => void {
      messageListeners.add(listener);
      return () => {
        messageListeners.delete(listener);
      };
    },
    onStatus(listener: (next: RoomStatus) => void): () => void {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
  };
}
