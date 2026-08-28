/**
 * ADAPTER: workspace store. Wired to src/store (A2).
 * The shell only ever touches createStore and withAudit.
 */
import { appendAudit, createWorkspaceStore, makeAuditEvent } from "../../store";
import type { Actor, Workspace, WorkspaceMode, WorkspaceStore } from "../../types";

export interface StoreOptions {
  readonly mode: WorkspaceMode;
}

export interface AuditInput {
  readonly actor: Actor;
  readonly tool?: string;
  readonly args?: unknown;
  readonly result?: string;
  readonly ok?: boolean;
}

/** Append one audit event immutably, hashed and capped by the store module. */
export function withAudit(workspace: Workspace, input: AuditInput): Workspace {
  return appendAudit(
    workspace,
    makeAuditEvent({
      actor: input.actor,
      tool: input.tool,
      args: input.args,
      result: input.result,
      ok: input.ok !== false,
    }),
  );
}

export function createStore(options: StoreOptions): WorkspaceStore {
  return createWorkspaceStore({ mode: options.mode });
}
