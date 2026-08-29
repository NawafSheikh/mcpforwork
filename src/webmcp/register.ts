/**
 * WebMCP registration. Prefers document.modelContext, falls back to navigator.modelContext
 * (Chrome 149), and degrades to a plain page when neither exists. Top level page only:
 * the API is not offered inside frames and we do not try.
 *
 * Registration is per pack (docs/PACKS.md). Each pack gets its own AbortController, so
 * switching a pack off in the Tools panel unregisters exactly its tools from
 * document.modelContext at once, and switching it back on registers them again. An agent
 * mid-task loses those tools on its next call, which is what the panel promises.
 */

import type { ToolDefinition } from "../types";
import { annotationsFor } from "./annotations";
import type { PackGate, ToolRegistry } from "./registry";

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

/** A pack gate that also says when it changed, so registration can follow the switches. */
export interface PackSwitches extends PackGate {
  subscribe(listener: () => void): () => void;
}

export interface RegisterOptions {
  /** Abort to unregister every tool, for example on unmount or unload. */
  readonly signal?: AbortSignal;
  /** Called when the host reports a toolchange event. */
  readonly onToolsChanged?: (names: readonly string[]) => void;
  readonly onError?: (error: unknown, where: string) => void;
  /** Pack switches. Without one, every tool is registered and stays registered. */
  readonly packs?: PackSwitches;
  /** Called with the live tool names after the first pass and after every switch. */
  readonly onRegistered?: (names: readonly string[]) => void;
}

export interface RegisterResult {
  readonly available: boolean;
  readonly registered: readonly string[];
  readonly api: ModelContextApi;
}

const noop = (): void => undefined;

/** The bucket for tools no pack claims. They are never switched off. */
const NO_PACK = "*";

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
  names: () => readonly string[],
  options: RegisterOptions,
): () => void {
  const handler = options.onToolsChanged;
  if (!handler || typeof context.addEventListener !== "function") return noop;
  const listener = (): void => handler(names());
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

/** Definitions the registry knows, bucketed by the pack that owns each one. */
function groupByPack(
  registry: ToolRegistry,
  definitions: readonly ToolDefinition[],
  gate: PackGate | undefined,
): ReadonlyMap<string, readonly ToolDefinition[]> {
  const groups = new Map<string, ToolDefinition[]>();
  for (const definition of definitions) {
    if (!registry.has(definition.name)) continue;
    const key = gate?.packOf(definition.name) ?? NO_PACK;
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [definition]);
    else list.push(definition);
  }
  return groups;
}

interface OpenPack {
  readonly controller: AbortController;
  readonly names: readonly string[];
}

/** Register one pack's tools behind its own controller. Aborting it unregisters them. */
function openPack(
  context: ModelContextLike,
  definitions: readonly ToolDefinition[],
  options: RegisterOptions,
): OpenPack {
  const controller = new AbortController();
  const undo: Array<() => void> = [];
  const names: string[] = [];
  for (const definition of definitions) {
    const remove = registerOne(context, definition, options.onError);
    if (remove === null) continue;
    names.push(definition.name);
    undo.push(remove);
  }
  controller.signal.addEventListener(
    "abort",
    () => {
      for (const step of undo) step();
    },
    { once: true },
  );
  return { controller, names };
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

  const groups = groupByPack(registry, definitions, options.packs);
  const live = new Map<string, OpenPack>();
  const names = (): readonly string[] =>
    [...groups.keys()].flatMap((key) => live.get(key)?.names ?? []);

  const sync = (): void => {
    let changed = false;
    for (const [key, group] of groups) {
      const wanted = key === NO_PACK || options.packs?.enabled(key) !== false;
      if (wanted === live.has(key)) continue;
      if (wanted) live.set(key, openPack(context, group, options));
      else {
        live.get(key)?.controller.abort();
        live.delete(key);
      }
      changed = true;
    }
    if (changed) options.onRegistered?.(names());
  };

  sync();
  const stopPacks = options.packs?.subscribe(sync) ?? noop;
  const detach = attachToolChange(context, names, options);
  options.signal?.addEventListener(
    "abort",
    () => {
      stopPacks();
      detach();
      for (const pack of live.values()) pack.controller.abort();
      live.clear();
      options.onRegistered?.([]);
    },
    { once: true },
  );
  return { available: true, registered: names(), api };
}
