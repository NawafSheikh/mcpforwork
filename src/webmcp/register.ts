/**
 * WebMCP registration. Prefers document.modelContext, falls back to navigator.modelContext
 * (Chrome 149), and degrades to a plain page when neither exists. Top level page only:
 * the API is not offered inside frames and we do not try.
 */

import type { ToolDefinition } from "../types";
import { annotationsFor } from "./annotations";
import type { ToolRegistry } from "./registry";

export type ModelContextApi = "document" | "navigator" | "none";

interface RegisteredToolInit {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly annotations: Record<string, unknown>;
  execute(params: unknown, ctx?: { signal?: AbortSignal }): Promise<string>;
}

export interface ModelContextLike {
  registerTool(tool: RegisteredToolInit): unknown;
  unregisterTool?(name: string): unknown;
  addEventListener?(type: string, listener: () => void): void;
  removeEventListener?(type: string, listener: () => void): void;
}

export interface RegisterOptions {
  /** Abort to unregister every tool, for example on unmount or unload. */
  readonly signal?: AbortSignal;
  /** Called when the host reports a toolchange event. */
  readonly onToolsChanged?: (names: readonly string[]) => void;
  readonly onError?: (error: unknown, where: string) => void;
}

export interface RegisterResult {
  readonly available: boolean;
  readonly registered: readonly string[];
  readonly api: ModelContextApi;
}

const noop = (): void => undefined;

function isTopLevel(): boolean {
  try {
    return typeof window !== "undefined" && window.top === window.self;
  } catch {
    return false;
  }
}

function pick(host: unknown): ModelContextLike | null {
  const candidate = (host as { modelContext?: ModelContextLike } | undefined)?.modelContext;
  return candidate && typeof candidate.registerTool === "function" ? candidate : null;
}

/** Feature detection, in the order the spec asks for. */
export function findModelContext(): { api: ModelContextApi; context: ModelContextLike | null } {
  if (typeof document === "undefined" || !isTopLevel()) return { api: "none", context: null };
  const fromDocument = pick(document);
  if (fromDocument) return { api: "document", context: fromDocument };
  const fromNavigator = typeof navigator === "undefined" ? null : pick(navigator);
  if (fromNavigator) return { api: "navigator", context: fromNavigator };
  return { api: "none", context: null };
}

function registerOne(
  context: ModelContextLike,
  definition: ToolDefinition,
  onError?: RegisterOptions["onError"],
): (() => void) | null {
  try {
    const handle = context.registerTool({
      name: definition.name,
      description: definition.description,
      inputSchema: definition.inputSchema,
      annotations: { ...annotationsFor(definition.name, definition.annotations) },
      execute: (params: unknown, ctx?: { signal?: AbortSignal }) =>
        definition.execute(params, { signal: ctx?.signal }),
    });
    if (typeof handle === "function") return handle as () => void;
    return () => {
      try {
        context.unregisterTool?.(definition.name);
      } catch (error) {
        onError?.(error, `unregisterTool:${definition.name}`);
      }
    };
  } catch (error) {
    onError?.(error, `registerTool:${definition.name}`);
    return null;
  }
}

function attachToolChange(
  context: ModelContextLike,
  names: readonly string[],
  options: RegisterOptions,
): () => void {
  const handler = options.onToolsChanged;
  if (!handler || typeof context.addEventListener !== "function") return noop;
  const listener = (): void => handler(names);
  try {
    context.addEventListener("toolchange", listener);
  } catch (error) {
    options.onError?.(error, "addEventListener:toolchange");
    return noop;
  }
  return () => {
    try {
      context.removeEventListener?.("toolchange", listener);
    } catch (error) {
      options.onError?.(error, "removeEventListener:toolchange");
    }
  };
}

/** Register every definition the registry knows about. Never throws. */
export async function registerAllTools(
  registry: ToolRegistry,
  definitions: readonly ToolDefinition[],
  options: RegisterOptions = {},
): Promise<RegisterResult> {
  const { api, context } = findModelContext();
  if (context === null) return { available: false, registered: [], api };
  if (options.signal?.aborted) return { available: true, registered: [], api };

  const registered: string[] = [];
  const undo: Array<() => void> = [];
  for (const definition of definitions) {
    if (!registry.has(definition.name)) continue;
    const remove = registerOne(context, definition, options.onError);
    if (remove === null) continue;
    registered.push(definition.name);
    undo.push(remove);
  }
  undo.push(attachToolChange(context, registered, options));
  options.signal?.addEventListener(
    "abort",
    () => {
      for (const step of undo) step();
    },
    { once: true },
  );
  return { available: true, registered, api };
}
