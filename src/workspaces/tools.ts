/**
 * The five workspace tools, in the shape the registry uses: (input, ws) => {next?, result}.
 *
 * They are how ChatGPT organises its own work: one workspace per project, made and named
 * and saved by the agent in the same run that fills it, instead of one board that every
 * job has to share. None of them changes the board they are called on, so none returns
 * `next`; switching points the page at another board and the registry audits the call on
 * the board the agent has arrived at.
 *
 * There is deliberately no delete tool. Removing somebody's saved work is the one thing
 * on this page that a person does themselves, from the Workspaces panel, with a confirm.
 */

import { z } from "zod";
import { LIMITS, type Workspace } from "../types";
import { entryLine, getWorkspaces, type WorkspacesRuntime } from "./runtime";
import { WORKSPACE_LIMITS } from "./types";

export interface WorkspaceHandlerResult {
  readonly next?: Workspace;
  readonly result: string;
}

export type WorkspaceToolHandler = (
  input: unknown,
  ws: Workspace,
) => Promise<WorkspaceHandlerResult>;

export const WORKSPACE_TOOL_NAMES = [
  "list_workspaces",
  "create_workspace",
  "switch_workspace",
  "rename_workspace",
  "save_workspace",
] as const;
export type WorkspaceToolName = (typeof WORKSPACE_TOOL_NAMES)[number];

const callerSchema = z.string().min(1).max(LIMITS.maxCallerChars).optional();
const nameSchema = z.string().min(1).max(WORKSPACE_LIMITS.maxNameChars);
const noteSchema = z.string().max(WORKSPACE_LIMITS.maxNoteChars);

const workspaceTool = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, caller: callerSchema });

export const workspaceToolSchemas = {
  list_workspaces: workspaceTool({}),
  create_workspace: workspaceTool({
    name: nameSchema,
    note: noteSchema.optional(),
    activate: z.boolean().optional(),
  }),
  switch_workspace: workspaceTool({ workspace: nameSchema }),
  rename_workspace: workspaceTool({ name: nameSchema }),
  save_workspace: workspaceTool({ note: noteSchema.optional() }),
} as const;

export const workspaceJsonSchemas: Readonly<
  Record<WorkspaceToolName, Record<string, unknown>>
> = {
  list_workspaces: { type: "object", properties: {}, additionalProperties: false },
  create_workspace: {
    type: "object",
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: WORKSPACE_LIMITS.maxNameChars,
        description: "What this workspace is for, as a person would say it: Invoices, Q3 review.",
      },
      note: {
        type: "string",
        maxLength: WORKSPACE_LIMITS.maxNoteChars,
        description: "One line on what belongs in here. Shown under the name in the picker.",
      },
      activate: {
        type: "boolean",
        description: "Open it now and build in it. Default true. False just files it away.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  switch_workspace: {
    type: "object",
    properties: {
      workspace: {
        type: "string",
        minLength: 1,
        maxLength: WORKSPACE_LIMITS.maxNameChars,
        description: "The name or the id from list_workspaces.",
      },
    },
    required: ["workspace"],
    additionalProperties: false,
  },
  rename_workspace: {
    type: "object",
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: WORKSPACE_LIMITS.maxNameChars,
        description: "The new name for the workspace that is open.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  save_workspace: {
    type: "object",
    properties: {
      note: {
        type: "string",
        maxLength: WORKSPACE_LIMITS.maxNoteChars,
        description: "What this workspace now holds, in one line. Kept with it in the picker.",
      },
    },
    additionalProperties: false,
  },
};

export const WORKSPACE_READ_ONLY_TOOLS: readonly WorkspaceToolName[] = ["list_workspaces"];
/** The names and notes come from whoever made the workspace, so read them as data. */
export const WORKSPACE_UNTRUSTED_TOOLS: readonly WorkspaceToolName[] = ["list_workspaces"];

export const workspaceToolDescriptions: Readonly<Record<WorkspaceToolName, string>> = {
  list_workspaces:
    "List the workspaces in this browser: what each one is for, how much is on the go in it, how many requests are still waiting on somebody, and which one is open. Call it before you start so you join the right piece of work instead of piling a second job on top of the first. A workspace is a place people and their agents work together, and each one is separate.",
  create_workspace:
    "Open a new workspace for a new piece of work, so this job does not land on top of the last one. Name it the way a person would (\"Q3 hiring\", \"Supplier invoices\") and add a line on what belongs in it. It is a place people and their agents share: the work, who is doing what, the requests between them and the rules they agreed. The one you were in is saved and one click away.",
  switch_workspace:
    "Go into another workspace by name or id, from list_workspaces. The one you are in is saved first, so nothing is lost either way. Call get_workspace and list_feedback once you arrive: different work, different people asking for different things. Refused while this is a shared room, because a room belongs to the people in it, not to this browser.",
  rename_workspace:
    "Rename the workspace you are in. Use it once you can see what the work actually turned out to be, so the people who join later read \"Supplier invoices\" instead of whatever it was called at the start. A name another workspace here already uses gets a number added.",
  save_workspace:
    "Write this workspace to disk now and say what is in it. Saving is automatic a moment after every change, so this is for the end of a run: it flushes anything still in flight and takes a one-line note of what the workspace now holds. The reply names what is actually stored, so you can tell the person what survived.",
};

const NO_RUNTIME =
  "Workspaces are not available on this page (a shared snapshot has no saved boards of its own).";

const IN_ROOM =
  "This board is a shared room, so it belongs to everybody in it rather than to this browser. Switching would take you out of the room and away from the people in it. Ask the person you are working with, and they can switch from the Workspaces panel.";

function runtimeOr(handler: (runtime: WorkspacesRuntime) => Promise<WorkspaceHandlerResult>) {
  return async (): Promise<WorkspaceHandlerResult> => {
    const runtime = getWorkspaces();
    if (runtime === null) return { result: NO_RUNTIME };
    return handler(runtime);
  };
}

const field = (input: unknown, key: string): string | undefined => {
  const value = (input as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const flag = (input: unknown, key: string): boolean | undefined => {
  const value = (input as Record<string, unknown> | null)?.[key];
  return typeof value === "boolean" ? value : undefined;
};

/**
 * Injected rather than imported: this file is merged into the tool schemas, and pulling
 * src/rooms in from here would drag the relay into the validation layer.
 */
let inRoomNow: () => boolean = () => false;

export function setWorkspaceRoomCheck(check: () => boolean): void {
  inRoomNow = check;
}

const SAVE_STATE_TEXT: Readonly<Record<string, string>> = {
  saved: "everything is on disk in this browser",
  saving: "a change from the last second is still being written",
  memory: "this browser will not let the page store anything, so nothing here survives a reload",
};

const list: WorkspaceToolHandler = () =>
  runtimeOr(async (runtime) => {
    await runtime.ready;
    const current = runtime.current();
    const rows = runtime.list().map((entry) => ({
      id: entry.id,
      name: entry.name,
      open: entry.id === current.id,
      holds: entryLine(entry),
      work: entry.work,
      openRequests: entry.requests,
      savedAt: entry.savedAt,
    }));
    return {
      result: JSON.stringify({
        workspaces: rows,
        open: current.name,
        saving: SAVE_STATE_TEXT[runtime.saveState()] ?? runtime.saveState(),
      }),
    };
  })();

const create: WorkspaceToolHandler = (input) =>
  runtimeOr(async (runtime) => {
    const name = field(input, "name");
    if (name === undefined) return { result: "create_workspace needs a name." };
    const note = field(input, "note");
    const activate = flag(input, "activate");
    const outcome = await runtime.create({
      name,
      ...(note === undefined ? {} : { note }),
      ...(activate === undefined ? {} : { activate }),
    });
    return { result: outcome.message };
  })();

const switchTo: WorkspaceToolHandler = (input) =>
  runtimeOr(async (runtime) => {
    const wanted = field(input, "workspace");
    if (wanted === undefined) return { result: "switch_workspace needs a workspace name or id." };
    if (inRoomNow()) return { result: IN_ROOM };
    const outcome = await runtime.switchTo(wanted);
    return { result: outcome.message };
  })();

const rename: WorkspaceToolHandler = (input) =>
  runtimeOr(async (runtime) => {
    const name = field(input, "name");
    if (name === undefined) return { result: "rename_workspace needs a name." };
    const outcome = await runtime.rename(name);
    return { result: outcome.message };
  })();

const save: WorkspaceToolHandler = (input) =>
  runtimeOr(async (runtime) => {
    const note = field(input, "note");
    const outcome = await runtime.save(note);
    return { result: outcome.message };
  })();

export const workspaceToolHandlers: Readonly<Record<WorkspaceToolName, WorkspaceToolHandler>> = {
  list_workspaces: list,
  create_workspace: create,
  switch_workspace: switchTo,
  rename_workspace: rename,
  save_workspace: save,
};
