/**
 * The page side of the local bridge (mcpforwork-bridge/docs/CONTRACT.md).
 *
 * One WebSocket to 127.0.0.1, one JSON object per frame: `hello` on connect, `call` out,
 * `result` back, `event` unprompted. The bridge is a separate project and is never
 * imported from here; this file speaks its wire protocol and nothing else.
 *
 * The socket is injected, so the same client runs against a real WebSocket in the
 * browser and against a plain object in a test. There is no auto-connect: nothing opens
 * until a person switches Local bridge on in the Tools panel.
 */

export type BridgeRisk = "read" | "write" | "send" | "move";
export type Who = "person" | "agent";

export const DEFAULT_BRIDGE_URL = "ws://127.0.0.1:7331";

export interface BridgeToolSpec {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly annotations: { readonly readOnlyHint?: boolean; readonly untrustedContentHint?: boolean };
}

export interface RobotProfile {
  readonly name: string;
  readonly kind: string;
  readonly frame: { readonly units: string; readonly origin: string };
  readonly capabilities: readonly string[];
  readonly limits: { readonly maxMoveCm: number; readonly minClearanceCm: number };
  readonly sensors: readonly string[];
  readonly safety: { readonly stop: boolean; readonly boundary: boolean };
  readonly owner: string;
  readonly fingerprint: string;
}

export interface BridgePack {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly risk: BridgeRisk;
  readonly tools: readonly BridgeToolSpec[];
  readonly robot?: RobotProfile;
}

export interface BridgeIdentity {
  readonly fingerprint: string;
  readonly publicKey: string;
  readonly signature: string;
}

export interface BridgeHello {
  readonly version: string;
  readonly packs: readonly BridgePack[];
  readonly identity?: BridgeIdentity;
}

export interface BridgeEvent {
  readonly kind: string;
  readonly payload: unknown;
}

export interface CallOutcome {
  readonly ok: boolean;
  readonly result: string;
}

/** The slice of WebSocket this client uses, so a test can hand it a plain object. */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((event?: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event?: unknown) => void) | null;
  onerror: ((event?: unknown) => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;

export const DISCONNECTED = "bridge.disconnected";

interface Waiting {
  resolve(value: CallOutcome): void;
  reject(error: Error): void;
}

function parse(data: unknown): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(typeof data === "string" ? data : String(data));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function defaultFactory(url: string): SocketLike {
  const Ctor = (globalThis as { WebSocket?: new (url: string) => SocketLike }).WebSocket;
  if (!Ctor) throw new Error("this browser has no WebSocket");
  return new Ctor(url);
}

/**
 * A pack that can move something must carry a profile that can be stopped inside a
 * boundary. The bridge already refuses these, so one arriving here means something is
 * wrong on the other side and it is dropped with a reason the panel can show.
 */
export function refusalFor(pack: BridgePack): string | null {
  if (pack.risk !== "move") return null;
  const safety = pack.robot?.safety;
  if (safety === undefined) return `${pack.id}: a pack that can move things must carry a robot profile`;
  if (!safety.stop || !safety.boundary) {
    return `${pack.id}: this robot does not declare both a stop and a boundary`;
  }
  return null;
}

export interface Accepted {
  readonly packs: readonly BridgePack[];
  readonly refused: readonly string[];
}

export function acceptPacks(packs: readonly BridgePack[]): Accepted {
  const kept: BridgePack[] = [];
  const refused: string[] = [];
  for (const pack of packs) {
    const reason = refusalFor(pack);
    if (reason === null) kept.push(pack);
    else refused.push(reason);
  }
  return { packs: kept, refused };
}

export class BridgeClient {
  private socket: SocketLike | null = null;
  private hello: BridgeHello | null = null;
  private readonly pending = new Map<string, Waiting>();
  private readonly listeners = new Set<(event: BridgeEvent) => void>();
  private counter = 0;
  /** True between the socket opening and the one disconnect notice it is allowed. */
  private alive = false;

  constructor(
    private readonly url: string = DEFAULT_BRIDGE_URL,
    private readonly open: SocketFactory = defaultFactory,
  ) {}

  /** Connect and settle when the bridge has said hello. Never auto-called. */
  connect(): Promise<BridgeHello> {
    return new Promise<BridgeHello>((resolve, reject) => {
      let socket: SocketLike;
      try {
        socket = this.open(this.url);
      } catch (error) {
        reject(asError(error));
        return;
      }
      this.socket = socket;
      this.alive = true;
      socket.onerror = () =>
        reject(
          new Error(
            `Could not reach the bridge at ${this.url}. Either nothing is listening there, or the browser blocked local access: press Connect again and allow it when the browser asks.`,
          ),
        );
      socket.onclose = () => this.dropped();
      socket.onmessage = (event) => {
        const message = parse(event.data);
        if (message === null) return;
        if (message["t"] === "hello") {
          this.hello = {
            version: String(message["version"] ?? ""),
            packs: Array.isArray(message["packs"]) ? (message["packs"] as readonly BridgePack[]) : [],
            ...(message["identity"] === undefined
              ? {}
              : { identity: message["identity"] as BridgeIdentity }),
          };
          resolve(this.hello);
          return;
        }
        this.route(message);
      };
    });
  }

  get packs(): readonly BridgePack[] {
    return this.hello?.packs ?? [];
  }

  get identity(): BridgeIdentity | null {
    return this.hello?.identity ?? null;
  }

  get connected(): boolean {
    return this.socket !== null;
  }

  /** The robot profiles this bridge serves, for the capability card. */
  get robots(): readonly RobotProfile[] {
    return this.packs
      .map((pack) => pack.robot)
      .filter((robot): robot is RobotProfile => robot !== undefined);
  }

  onEvent(listener: (event: BridgeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Call one bridge tool. Results are strings, always under 1500 characters. */
  call(tool: string, input: unknown, caller: string, who: Who = "agent"): Promise<CallOutcome> {
    const socket = this.socket;
    if (socket === null) return Promise.reject(new Error("the local bridge is not connected"));
    this.counter += 1;
    const id = `call-${Date.now().toString(36)}-${this.counter}`;
    return new Promise<CallOutcome>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        socket.send(JSON.stringify({ t: "call", id, tool, input, caller, who }));
      } catch (error) {
        this.pending.delete(id);
        reject(asError(error));
      }
    });
  }

  close(): void {
    const socket = this.socket;
    this.socket = null;
    try {
      socket?.close();
    } catch {
      /* a socket that will not close is already gone */
    }
    this.dropped();
  }

  private route(message: Record<string, unknown>): void {
    if (message["t"] === "result") {
      const waiting = this.pending.get(String(message["id"] ?? ""));
      if (waiting === undefined) return;
      this.pending.delete(String(message["id"] ?? ""));
      waiting.resolve({ ok: message["ok"] === true, result: String(message["result"] ?? "") });
      return;
    }
    if (message["t"] === "event") {
      const event = { kind: String(message["kind"] ?? ""), payload: message["payload"] };
      for (const listener of [...this.listeners]) listener(event);
    }
  }

  private dropped(): void {
    if (!this.alive) return;
    this.alive = false;
    const error = new Error("the local bridge disconnected");
    for (const [, waiting] of this.pending) waiting.reject(error);
    this.pending.clear();
    this.hello = null;
    this.socket = null;
    for (const listener of [...this.listeners]) listener({ kind: DISCONNECTED, payload: null });
  }
}
