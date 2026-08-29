/**
 * Tool registry: the one door between the agent and the workspace.
 * Every call is validated with zod, checked against the turn model, rate limited, run
 * against a snapshot, audited and truncated. Nothing here throws at the agent: failures come back as plain sentences
 * it can act on. The optional caller is peeled off here, so handlers never see it and
 * every audit event carries the name of the sub-agent that made the call.
 */

import type { z } from "zod";
import { LIMITS, type Workspace, type WorkspaceStore } from "../types";
import { appendAudit, makeAuditEvent, truncate } from "../store/audit";
import { packOffText } from "../packs/registry";
import { withFeedbackNotice } from "./feedbackTools";
import { openTurn, settleTurn } from "../turns/gate";
import {
  TOOL_NAMES,
  callerSchema,
  isToolName,
  toolSchemas,
  type ToolInputs,
  type ToolName,
} from "./schemas";

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

/**
 * Which packs are on right now (docs/PACKS.md). Supplied by src/packs; without one every
 * tool answers, which is what a board with no Tools panel wired should do.
 */
export interface PackGate {
  /** The pack a tool belongs to, or null for a tool no pack claims. */
  packOf(tool: string): string | null;
  enabled(packId: string): boolean;
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
  /** Pack switches. A tool whose pack is off is refused here as well as unregistered. */
  readonly packs?: PackGate;
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

/** The agent names itself; we validate it like any other input and never act on it. */
function readCaller(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const parsed = callerSchema.safeParse((input as { caller?: unknown }).caller);
  return parsed.success ? parsed.data : undefined;
}

/** Handlers are written against their own fields, so caller never reaches them. */
function withoutCaller(data: unknown): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return data;
  const { caller: _caller, ...rest } = data as Record<string, unknown>;
  return rest;
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
    caller?: string,
    next?: Workspace,
  ): Promise<string> => {
    const text = truncate(result, LIMITS.toolOutputChars);
    const event = makeAuditEvent({ actor: "agent", caller, tool: name, args, result: text, ok });
    await opts.store.update((current) => appendAudit(next ?? current, event));
    return text;
  };

  const execute = async (name: string, input: unknown, ctx?: ToolCallContext): Promise<string> => {
    if (ctx?.signal?.aborted) return abortedText(name);
    const caller = readCaller(input);
    if (!limiter.take()) return record(name, input, rateLimitText(maxCalls), false, caller);
    if (!isToolName(name)) return record(name, input, unknownText(name), false, caller);
    // A pack switched off in the Tools panel is off for everybody, including an agent
    // still holding a tool list from before the switch moved.
    const pack = opts.packs?.packOf(name) ?? null;
    if (pack !== null && opts.packs?.enabled(pack) === false) {
      return record(name, input, packOffText(pack), false, caller);
    }
    const schema: z.ZodTypeAny = toolSchemas[name];
    const parsed = schema.safeParse(input ?? {});
    if (!parsed.success) {
      return record(name, input, describeIssues(name, parsed.error), false, caller);
    }
    const args = withoutCaller(parsed.data);
    // One cast: the map is keyed by tool name, the value was just validated by that key.
    const handler = opts.handlers[name] as unknown as ToolHandler<unknown> | undefined;
    if (!handler) return record(name, args, notWiredText(name), false, caller);
    try {
      const before = opts.store.get();
      // Turns come first. A write that lands on somebody else's recent change is merged
      // with the board and says so; only a real collision comes back (docs/TURNS.md).
      const turn = openTurn(before, name, args, caller);
      if (turn.refusal !== undefined) return await record(name, args, turn.refusal, false, caller);
      const raw = await handler(turn.input, before);
      const noticed = withFeedbackNotice(name, turn.input, before, raw);
      const outcome = settleTurn(name, turn.input, noticed, caller);
      return await record(name, args, `${outcome.result}${turn.note}`, true, caller, outcome.next);
    } catch (error) {
      return record(name, args, failureText(name, error), false, caller);
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
