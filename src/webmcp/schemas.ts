/**
 * Zod schemas for every WebMCP tool input (docs/TOOLS.md is the contract).
 * The agent is never trusted: the registry parses with these before a handler runs.
 * Unknown keys are stripped rather than rejected so a slightly wrong call still lands.
 */

import { z } from "zod";
import { LIMITS } from "../types";
/**
 * Rooms (A10) and datasets (A11) ship their own zod shapes. They are merged here, from the
 * leaf files rather than the module barrels, so registering a tool never drags a React
 * component or a spreadsheet parser into the validation layer.
 */
import { capabilityToolSchemas } from "../capabilities/tools";
import { datasetToolSchemas } from "../dataset/schemas";
import { roomToolSchemas } from "../rooms/handlers";
import { turnToolSchemas } from "../turns/tools";

export const kpiSchema = z.object({
  label: z.string().min(1).max(40),
  value: z.union([z.string().max(40), z.number()]),
  delta: z.string().max(20).optional(),
  hint: z.string().max(80).optional(),
});

export const chartPointSchema = z.object({
  label: z.string().min(1).max(40),
  value: z.number(),
  series: z.string().max(30).optional(),
});

export const chartSchema = z.object({
  id: z.string().max(40).optional(),
  kind: z.enum(["bar", "line", "donut", "table"]),
  title: z.string().min(1).max(80),
  points: z.array(chartPointSchema).max(LIMITS.maxPointsPerChart).default([]),
  columns: z.array(z.string().max(40)).max(8).optional(),
  rows: z.array(z.array(z.union([z.string().max(60), z.number()])).max(8)).max(LIMITS.maxTableRows).optional(),
  note: z.string().max(160).optional(),
});

export const thresholdSchema = z.object({
  field: z.string().min(1).max(40),
  op: z.enum(["gt", "gte", "lt", "lte", "eq"]),
  value: z.number(),
  label: z.string().max(60).optional(),
});

export const policySchema = z.object({
  maxAutoActionsPerRun: z.number().int().min(0).max(50),
  thresholds: z.array(thresholdSchema).max(10).optional(),
  allowlist: z.array(z.string().max(60)).max(50).optional(),
  denylist: z.array(z.string().max(60)).max(50).optional(),
  requireHumanFor: z.array(z.string().max(60)).max(20).optional(),
  notes: z.string().max(300).optional(),
});

export const draftInputSchema = z.object({
  kind: z.string().min(1).max(40),
  target: z.string().min(1).max(80),
  summary: z.string().min(1).max(200),
  amount: z.number().optional(),
  fields: z.record(z.union([z.string().max(120), z.number()])).optional(),
});

export const feedbackTargetSchema = z.object({
  kind: z.enum(["dashboard", "overview", "draft", "monitor", "agent", "room", "person"]),
  id: z.string().min(1).max(80),
});

const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const categoryName = z
  .string()
  .min(1)
  .max(60)
  .refine((value) => !RESERVED_KEYS.has(value.trim()), { message: "that name is reserved" });

/** Every tool accepts the same optional caller so parallel sub-agents can name themselves. */
export const callerSchema = z.string().min(1).max(LIMITS.maxCallerChars).optional();

const tool = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, caller: callerSchema });

/**
 * The registry strips `caller` before a handler runs, which is right for every tool that
 * only wants it in the audit trail. The two feedback tools also need to know who is
 * asking, to sign a note and to sort the notes addressed to that name first, so they copy
 * it into `from`. Self-reported and never trusted: it labels and orders, nothing else.
 */
const addressedTool = <T extends z.ZodRawShape>(shape: T) =>
  tool(shape).transform((value) => ({ ...value, from: value.caller }));

const emptyInput = tool({});

/**
 * The stamp a read handed back. When it is present and the object has moved since, the
 * write is refused instead of overwriting whatever the other party did (docs/TURNS.md).
 */
const expectedUpdatedAt = z.string().max(40).optional();

export const toolSchemas = {
  /** Addressed: it answers "you hold X, N requests are waiting on you" for this caller. */
  get_workspace: addressedTool({}),
  create_category: tool({
    name: categoryName,
    description: z.string().max(300).optional(),
    provenance: z.string().max(200).optional(),
  }),
  upsert_dataset_summary: tool({
    category: categoryName,
    counts: z.record(z.number()).optional(),
    sums: z.record(z.number()).optional(),
    top: z.record(z.array(z.object({ label: z.string().min(1).max(40), value: z.number() })).max(LIMITS.maxPointsPerChart)).optional(),
    period: z.string().max(60).optional(),
    rowCount: z.number().int().min(0).optional(),
  }),
  upsert_dashboard: tool({
    category: categoryName,
    title: z.string().max(80).optional(),
    kpis: z.array(kpiSchema).min(1).max(LIMITS.maxKpis),
    charts: z.array(chartSchema).max(LIMITS.maxCharts).optional(),
    notes: z.array(z.string().max(160)).max(6).optional(),
    source: z.string().max(120).optional(),
    expectedUpdatedAt,
  }),
  get_dashboard: tool({ category: categoryName }),
  compose_overview: tool({
    title: z.string().min(1).max(80),
    kpis: z.array(kpiSchema).min(1).max(6),
    charts: z.array(chartSchema).max(LIMITS.maxCharts).optional(),
    highlights: z.array(z.string().max(160)).max(6).optional(),
    expectedUpdatedAt,
  }),
  register_monitor: tool({
    name: z.string().min(1).max(60),
    category: categoryName,
    schedule: z.string().min(1).max(80),
    policy: policySchema,
    runner: z.enum(["local", "cloud"]),
  }),
  report_monitor_run: tool({
    monitorId: z.string().min(1).max(60),
    findings: z.array(z.string().max(200)).max(20).default([]),
    drafts: z.array(draftInputSchema).max(20).default([]),
  }),
  list_monitors: emptyInput,
  get_run_log: tool({
    monitorId: z.string().max(60).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  approve_draft: tool({
    draftId: z.string().min(1).max(60),
    note: z.string().max(200).optional(),
  }),
  decline_draft: tool({
    draftId: z.string().min(1).max(60),
    reason: z.string().max(200).optional(),
  }),
  set_policy: tool({
    monitorId: z.string().min(1).max(60),
    policy: policySchema,
    expectedUpdatedAt,
  }),
  add_feedback: addressedTool({
    target: feedbackTargetSchema,
    text: z.string().min(1).max(LIMITS.maxFeedbackChars),
  }),
  list_feedback: addressedTool({
    target: feedbackTargetSchema.optional(),
    includeResolved: z.boolean().optional(),
  }),
  resolve_feedback: tool({
    feedbackId: z.string().min(1).max(60),
    resolution: z.string().min(1).max(200),
  }),
  share_board: emptyInput,
  clear_workspace: tool({
    confirm: z.literal(true),
  }),
  ...roomToolSchemas,
  ...datasetToolSchemas,
  ...turnToolSchemas,
  ...capabilityToolSchemas,
} as const;

export type ToolName = keyof typeof toolSchemas;
export type ToolInputs = { [K in ToolName]: z.infer<(typeof toolSchemas)[K]> };

export const TOOL_NAMES = Object.keys(toolSchemas) as readonly ToolName[];

export function isToolName(name: string): name is ToolName {
  return Object.prototype.hasOwnProperty.call(toolSchemas, name);
}

export type KPIInput = z.infer<typeof kpiSchema>;
export type ChartPointInput = z.infer<typeof chartPointSchema>;
export type ChartInput = z.infer<typeof chartSchema>;
export type PolicyInput = z.infer<typeof policySchema>;
export type ThresholdInput = z.infer<typeof thresholdSchema>;
export type DraftInput = z.infer<typeof draftInputSchema>;
export type FeedbackTargetInput = z.infer<typeof feedbackTargetSchema>;

export type GetWorkspaceInput = ToolInputs["get_workspace"];
export type CreateCategoryInput = ToolInputs["create_category"];
export type UpsertDatasetSummaryInput = ToolInputs["upsert_dataset_summary"];
export type UpsertDashboardInput = ToolInputs["upsert_dashboard"];
export type GetDashboardInput = ToolInputs["get_dashboard"];
export type ComposeOverviewInput = ToolInputs["compose_overview"];
export type RegisterMonitorInput = ToolInputs["register_monitor"];
export type ReportMonitorRunInput = ToolInputs["report_monitor_run"];
export type ListMonitorsInput = ToolInputs["list_monitors"];
export type GetRunLogInput = ToolInputs["get_run_log"];
export type ApproveDraftInput = ToolInputs["approve_draft"];
export type DeclineDraftInput = ToolInputs["decline_draft"];
export type SetPolicyInput = ToolInputs["set_policy"];
export type AddFeedbackInput = ToolInputs["add_feedback"];
export type ListFeedbackInput = ToolInputs["list_feedback"];
export type ResolveFeedbackInput = ToolInputs["resolve_feedback"];
export type ShareBoardInput = ToolInputs["share_board"];
export type ClearWorkspaceInput = ToolInputs["clear_workspace"];
export type ClaimInput = ToolInputs["claim"];
export type ReleaseInput = ToolInputs["release"];
export type ListClaimsInput = ToolInputs["list_claims"];
