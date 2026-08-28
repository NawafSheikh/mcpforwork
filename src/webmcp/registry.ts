/**
 * Tool registry: the one door between the agent and the workspace.
 * Every call is validated with zod, rate limited, run against a snapshot, audited and
 * truncated. Nothing here throws at the agent: failures come back as plain sentences
 * it can act on.
 */

import type { z } from "zod";
import { LIMITS, type Workspace, type WorkspaceStore } from "../types";
import { appendAudit, makeAuditEvent, truncate } from "../store/audit";
import { TOOL_NAMES, isToolName, toolSchemas, type ToolInputs, type ToolName } from "./schemas";

export interface HandlerResult {
  /** The workspace the tool wants next. Omit for read only tools. */
  readonly next?: Workspace;
  readonly result: string;
}

export type ToolHandler<TInput = unknown> = (
  input: TInput,
  ws: Workspace,
) => HandlerResult | Promise<HandlerResult>;

/** What A3 and A5 implement: one entry per tool they own, typed by its zod input. */
export type HandlerMap = { readonly [K in ToolName]?: ToolHandler<ToolInputs[K]> };

export interface ToolCallContext {
  readonly signal?: AbortSignal;
}

export interface ToolRegistry {
  call(name: string, input: unknown, ctx?: ToolCallContext): Promise<string>;
  /** True when the name is part of the published contract. */
  has(name: string): boolean;
  names(): readonly ToolName[];
  /** Names that actually have a handler behind them right now. */
  wired(): readonly ToolName[];
}

export interface RegistryOptions {
  readonly store: WorkspaceStore;
  readonly handlers: HandlerMap;
  readonly maxCallsPerMinute?: number;
  readonly windowMs?: number;
  readonly now?: () => number;
}

const WINDOW_MS = 60_000;
const MAX_ISSUES = 6;

const abortedText = (name: string): string => `Call to ${name} was aborted before it ran.`;

const unknownText = (name: string): string =>
  `Unknown tool "${name}". Call get_workspace to see what this page offers.`;

const notWiredText = (name: string): string =>
  `Tool ${name} is not wired yet in this build. The workspace is unchanged.`;

const rateLimitText = (max: number): string =>
  `Rate limit: more than ${max} tool calls in the last minute. Wait a few seconds, then retry. The workspace is unchanged.`;

function failureText(name: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Tool ${name} failed: ${truncate(message, 160)}. The workspace is unchanged.`;
}

/** Friendly, path by path, so the agent can repair the call without guessing. */
export function describeIssues(name: string, error: z.ZodError): string {
  const issues = error.issues.slice(0, MAX_ISSUES).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
  const more = error.issues.length > MAX_ISSUES ? ` (+${error.issues.length - MAX_ISSUES} more)` : "";
  return `Invalid input for ${name}: ${issues.join("; ")}${more}. Fix these fields and call again; see the tool schema for the shapes.`;
}

function createRateLimiter(max: number, windowMs: number, now: () => number) {
  let stamps: readonly number[] = [];
  return {
    take(): boolean {
      const cutoff = now() - windowMs;
      const live = stamps.filter((stamp) => stamp > cutoff);
      if (live.length >= max) {
        stamps = live;
        return false;
      }
      stamps = [...live, now()];
      return true;
    },
  };
}

function createQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  const settle = (): void => undefined;
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.then(settle, settle);
    return run;
  };
}

export function createToolRegistry(opts: RegistryOptions): ToolRegistry {
  const now = opts.now ?? (() => Date.now());
  const maxCalls = opts.maxCallsPerMinute ?? LIMITS.maxToolCallsPerMinute;
  const limiter = createRateLimiter(maxCalls, opts.windowMs ?? WINDOW_MS, now);
  const enqueue = createQueue();

  /** Single write point: apply the handler's workspace, then append the audit event. */
  const record = async (
    name: string,
    args: unknown,
    result: string,
    ok: boolean,
    next?: Workspace,
  ): Promise<string> => {
    const text = truncate(result, LIMITS.toolOutputChars);
    const event = makeAuditEvent({ actor: "agent", tool: name, args, result: text, ok });
    await opts.store.update((current) => appendAudit(next ?? current, event));
    return text;
  };

  const execute = async (name: string, input: unknown, ctx?: ToolCallContext): Promise<string> => {
    if (ctx?.signal?.aborted) return abortedText(name);
    if (!isToolName(name)) return record(name, input, unknownText(name), false);
    if (!limiter.take()) return record(name, input, rateLimitText(maxCalls), false);
    const schema: z.ZodTypeAny = toolSchemas[name];
    const parsed = schema.safeParse(input ?? {});
    if (!parsed.success) return record(name, input, describeIssues(name, parsed.error), false);
    // One cast: the map is keyed by tool name, the value was just validated by that key.
    const handler = opts.handlers[name] as unknown as ToolHandler<unknown> | undefined;
    if (!handler) return record(name, parsed.data, notWiredText(name), false);
    try {
      const outcome = await handler(parsed.data, opts.store.get());
      return await record(name, parsed.data, outcome.result, true, outcome.next);
    } catch (error) {
      return record(name, parsed.data, failureText(name, error), false);
    }
  };

  return {
    has: (name: string) => isToolName(name),
    names: () => TOOL_NAMES,
    wired: () => TOOL_NAMES.filter((name) => opts.handlers[name] !== undefined),
    call: (name: string, input: unknown, ctx?: ToolCallContext) =>
      enqueue(() => execute(name, input, ctx)),
  };
}
