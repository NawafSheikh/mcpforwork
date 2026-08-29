/** Shared test scaffolding for the packs and capabilities suites. */
import { emptyWorkspace } from "../../store/createStore";
import type { ToolDefinition, Workspace } from "../../types";
import type { ModelContextLike } from "../../webmcp/register";
import type { SocketLike } from "../bridge";

export function defaultPacksFixture(): Workspace {
  return emptyWorkspace("local", "2026-08-29T10:00:00.000Z");
}

export interface FakeContext extends ModelContextLike {
  readonly tools: Map<string, ToolInit>;
}

interface ToolInit {
  readonly annotations: Record<string, unknown>;
  execute(params: unknown): Promise<string>;
}

/** A modelContext that records what is registered, so a switch can be watched. */
export function fakeContext(): FakeContext {
  const tools = new Map<string, ToolInit>();
  return {
    tools,
    registerTool(tool: Parameters<ModelContextLike["registerTool"]>[0]) {
      tools.set(tool.name, { annotations: tool.annotations, execute: tool.execute });
      return () => tools.delete(tool.name);
    },
    addEventListener() {
      /* nothing listens in these tests */
    },
    removeEventListener() {
      /* nothing listens in these tests */
    },
  };
}

export function installContext(context: FakeContext): void {
  Object.defineProperty(document, "modelContext", { value: context, configurable: true });
}

export function removeContext(): void {
  Reflect.deleteProperty(document, "modelContext");
}

export interface FakeSocket {
  readonly socket: SocketLike;
  readonly sent: readonly string[];
  readonly frames: readonly Record<string, unknown>[];
  deliver(message: unknown): void;
  drop(): void;
  readonly closed: () => boolean;
}

/** A plain object with the four handlers, which is all the bridge client touches. */
export function fakeSocket(): FakeSocket {
  const sent: string[] = [];
  const frames: Record<string, unknown>[] = [];
  let closed = false;
  const socket: SocketLike = {
    send(data: string): void {
      sent.push(data);
      frames.push(JSON.parse(data) as Record<string, unknown>);
    },
    close(): void {
      closed = true;
    },
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  };
  return {
    socket,
    sent,
    frames,
    deliver(message: unknown): void {
      socket.onmessage?.({ data: JSON.stringify(message) });
    },
    drop(): void {
      socket.onclose?.();
    },
    closed: () => closed,
  };
}

/** Definitions filtered down to the names a test cares about. */
export const namesOf = (definitions: readonly ToolDefinition[]): readonly string[] =>
  definitions.map((definition) => definition.name);
