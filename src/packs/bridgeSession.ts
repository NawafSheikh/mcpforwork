/**
 * The Local bridge section of the Tools panel, as a store.
 *
 * Connecting is a person's decision, never the page's: nothing here runs until somebody
 * switches Local bridge on. On hello the identity is verified, packs that can move
 * something without a stop and a boundary are dropped, and every remaining bridge pack
 * becomes a page pack, registered on document.modelContext behind its own controller so
 * one switch takes exactly its tools away. Everything is unregistered on disconnect.
 */

import { displayName } from "../feedback/identity";
import { findModelContext, type ModelContextLike } from "../webmcp/register";
import {
  BridgeClient,
  DEFAULT_BRIDGE_URL,
  DISCONNECTED,
  acceptPacks,
  type Accepted,
  type BridgeEvent,
  type BridgeHello,
  type BridgePack,
  type BridgeRisk,
  type RobotProfile,
  type SocketFactory,
} from "./bridge";
import { verifyHello, type IdentityVerdict } from "./bridgeIdentity";
import { emitPackToast } from "./events";
import { recordRun } from "./codeRuns";

export type BridgeStatus = "off" | "connecting" | "on" | "error";

export interface BridgePackView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly risk: BridgeRisk;
  readonly tools: number;
  readonly enabled: boolean;
  readonly robot?: RobotProfile;
}

export interface BridgeState {
  readonly status: BridgeStatus;
  readonly url: string;
  readonly version: string;
  readonly fingerprint: string;
  readonly verdict: IdentityVerdict;
  readonly packs: readonly BridgePackView[];
  readonly robots: readonly RobotProfile[];
  /** Packs this page refused, with the reason, so a broken bridge is visible. */
  readonly refused: readonly string[];
  readonly error: string;
  /** Tools registered on document.modelContext right now. */
  readonly registered: number;
}

export interface BridgeSession {
  get(): BridgeState;
  subscribe(listener: () => void): () => void;
  connect(): Promise<void>;
  disconnect(): void;
  setPack(id: string, enabled: boolean): void;
}

export interface BridgeSessionOptions {
  readonly url?: string;
  /** Injected socket, so the session can be tested without a robot anywhere near it. */
  readonly socket?: SocketFactory;
  /** Who the bridge is told is calling, when the agent does not name itself. */
  readonly caller?: () => string;
}

const idle = (url: string): BridgeState => ({
  status: "off",
  url,
  version: "",
  fingerprint: "",
  verdict: "unverified",
  packs: [],
  robots: [],
  refused: [],
  error: "",
  registered: 0,
});

/** One short line per bridge event, for the toast. */
export function eventText(event: BridgeEvent): string {
  const payload = (event.payload ?? {}) as { clause?: unknown; tool?: unknown; says?: unknown };
  const tool = typeof payload.tool === "string" ? ` ${payload.tool}` : "";
  if (event.kind === "queue.refused") {
    const clause = typeof payload.clause === "string" ? payload.clause : "a boundary";
    return `The robot refused${tool}: ${clause}. Nothing moved.`;
  }
  if (event.kind === "queue.enqueued") return `Queued${tool} on the robot.`;
  if (event.kind === "queue.started") return `Running${tool} on the robot.`;
  if (event.kind === "queue.stopped") return "The robot was stopped.";
  if (event.kind === "queue.finished" || event.kind === "run.recorded") {
    const says = typeof payload.says === "string" ? ` ${payload.says}` : "";
    return `Robot finished${tool}.${says}`.trim();
  }
  if (event.kind === "code.run") {
    const run = payload as { caller?: unknown; ok?: unknown; artifact?: unknown };
    const who = typeof run.caller === "string" ? run.caller : "An agent";
    const how = run.ok === false ? "ran something that failed" : "ran something";
    return `${who} ${how} on this machine${run.artifact ? ", with a picture" : ""}.`;
  }
  if (event.kind === "recipe.trial") return "The robot is trying a recipe.";
  return `Bridge: ${event.kind}`;
}

const toneFor = (kind: string): "info" | "warn" =>
  kind === "queue.refused" || kind === "queue.stopped" ? "warn" : "info";

function toolInit(
  pack: BridgePack,
  tool: BridgePack["tools"][number],
  client: BridgeClient,
  caller: () => string,
): Parameters<ModelContextLike["registerTool"]>[0] {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: { ...tool.annotations },
    execute: async (params: unknown): Promise<string> => {
      const named = (params as { caller?: unknown } | null)?.caller;
      const who = typeof named === "string" && named.trim().length > 0 ? named.trim() : caller();
      try {
        const outcome = await client.call(tool.name, params, who, "agent");
        return outcome.ok ? outcome.result : `Refused by ${pack.name}: ${outcome.result}`;
      } catch (error) {
        return `The local bridge did not answer: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };
}

/** Register one bridge pack. Aborting the returned controller unregisters exactly it. */
function openPack(
  context: ModelContextLike,
  pack: BridgePack,
  client: BridgeClient,
  caller: () => string,
): { readonly controller: AbortController; readonly count: number } {
  const controller = new AbortController();
  const undo: Array<() => void> = [];
  for (const tool of pack.tools) {
    try {
      const handle = context.registerTool(toolInit(pack, tool, client, caller));
      undo.push(
        typeof handle === "function"
          ? (handle as () => void)
          : () => context.unregisterTool?.(tool.name),
      );
    } catch {
      /* one tool the host refused is not a reason to lose the pack */
    }
  }
  controller.signal.addEventListener(
    "abort",
    () => {
      for (const step of undo) {
        try {
          step();
        } catch {
          /* unregistering something already gone is not an error */
        }
      }
    },
    { once: true },
  );
  return { controller, count: undo.length };
}

/** Which bridge packs are registered right now, and the handles to take them back off. */
interface Registrar {
  apply(pack: BridgePack, enabled: boolean, client: BridgeClient): void;
  closeAll(): void;
  count(): number;
  has(id: string): boolean;
}

function createRegistrar(caller: () => string): Registrar {
  const open = new Map<string, { controller: AbortController; count: number }>();
  return {
    apply(pack: BridgePack, enabled: boolean, client: BridgeClient): void {
      const context = findModelContext().context;
      if (enabled && context !== null && !open.has(pack.id)) {
        open.set(pack.id, openPack(context, pack, client, caller));
      }
      if (!enabled && open.has(pack.id)) {
        open.get(pack.id)?.controller.abort();
        open.delete(pack.id);
      }
    },
    closeAll(): void {
      for (const item of open.values()) item.controller.abort();
      open.clear();
    },
    count: () => [...open.values()].reduce((sum, item) => sum + item.count, 0),
    has: (id: string) => open.has(id),
  };
}

interface Handshake {
  readonly live: BridgeClient;
  readonly hello: BridgeHello;
  readonly verdict: IdentityVerdict;
  readonly accepted: Accepted;
}

const BAD_SIGNATURE = "The bridge signature did not check out. Nothing was registered.";

/**
 * Open the socket, wait for hello, check the identity, drop the packs this page will not
 * serve. Throws with the sentence the panel should show, and never leaves a socket open.
 */
async function handshake(url: string, socket: SocketFactory | undefined): Promise<Handshake> {
  const live = new BridgeClient(url, socket);
  try {
    const hello = await live.connect();
    const verdict = await verifyHello(hello);
    if (verdict === "failed") throw new Error(BAD_SIGNATURE);
    return { live, hello, verdict, accepted: acceptPacks(hello.packs) };
  } catch (error) {
    live.close();
    throw error instanceof Error ? error : new Error(String(error));
  }
}

const viewOf = (pack: BridgePack, enabled: boolean): BridgePackView => ({
  id: pack.id,
  name: pack.name,
  description: pack.description,
  risk: pack.risk,
  tools: pack.tools.length,
  enabled,
  ...(pack.robot === undefined ? {} : { robot: pack.robot }),
});

export function createBridgeSession(options: BridgeSessionOptions = {}): BridgeSession {
  const url = options.url ?? DEFAULT_BRIDGE_URL;
  const caller = options.caller ?? displayName;
  const listeners = new Set<() => void>();
  const packs = createRegistrar(caller);
  let state = idle(url);
  let client: BridgeClient | null = null;
  let stopEvents: () => void = () => undefined;
  let accepted: readonly BridgePack[] = [];

  const publish = (next: BridgeState): void => {
    state = next;
    for (const listener of [...listeners]) listener();
  };

  const refresh = (patch: Partial<BridgeState> = {}): void => {
    publish({
      ...state,
      ...patch,
      packs: accepted.map((pack) => viewOf(pack, packs.has(pack.id))),
      registered: packs.count(),
    });
  };

  const onEvent = (event: BridgeEvent): void => {
    // A run carries the code, the output and any picture, so the page can show what
    // actually happened rather than a sentence about it.
    if (event.kind === "code.run") recordRun(event.payload);
    if (event.kind === DISCONNECTED) {
      packs.closeAll();
      accepted = [];
      emitPackToast("The local bridge disconnected. Its tools are off the page.", "warn");
      publish({ ...idle(url), status: state.status === "error" ? "error" : "off", error: state.error });
      return;
    }
    emitPackToast(eventText(event), toneFor(event.kind));
  };

  const fail = (message: string): void => {
    packs.closeAll();
    accepted = [];
    stopEvents();
    client = null;
    publish({ ...idle(url), status: "error", error: message });
  };

  return {
    get: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async connect(): Promise<void> {
      if (state.status === "on" || state.status === "connecting") return;
      publish({ ...idle(url), status: "connecting" });
      try {
        const open = await handshake(url, options.socket);
        client = open.live;
        accepted = open.accepted.packs;
        stopEvents = open.live.onEvent(onEvent);
        for (const pack of accepted) packs.apply(pack, true, open.live);
        refresh({
          status: "on",
          version: open.hello.version,
          fingerprint: open.hello.identity?.fingerprint ?? "",
          verdict: open.verdict,
          robots: open.live.robots,
          refused: open.accepted.refused,
          error: "",
        });
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
    },
    disconnect(): void {
      packs.closeAll();
      accepted = [];
      stopEvents();
      stopEvents = () => undefined;
      client?.close();
      client = null;
      publish(idle(url));
    },
    setPack(id: string, enabled: boolean): void {
      const live = client;
      const pack = accepted.find((item) => item.id === id);
      if (live === null || pack === undefined) return;
      packs.apply(pack, enabled, live);
      refresh();
    },
  };
}

let shared: BridgeSession | null = null;

/** The one bridge session on this page, created on first use. */
export function localBridge(): BridgeSession {
  shared ??= createBridgeSession();
  return shared;
}

/** Tests only: drop the shared session so the next call builds a fresh one. */
export function resetLocalBridge(): void {
  shared?.disconnect();
  shared = null;
}
