/**
 * Zod schemas for every WebMCP tool input (docs/TOOLS.md is the contract).
 * The agent is never trusted: the registry parses with these before a handler runs.
 * Unknown keys are stripped rather than rejected so a slightly wrong call still lands.
 */

import { z } from "zod";
import { LIMITS } from "../types";

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

const categoryName = z.string().min(1).max(60);
const emptyInput = z.object({});

export const toolSchemas = {
  get_workspace: emptyInput,
  create_category: z.object({
    name: categoryName,
    description: z.string().max(300).optional(),
    provenance: z.string().max(200).optional(),
  }),
  upsert_dataset_summary: z.object({
    category: categoryName,
    counts: z.record(z.number()).optional(),
    sums: z.record(z.number()).optional(),
    top: z.record(z.array(z.object({ label: z.string().min(1).max(40), value: z.number() })).max(LIMITS.maxPointsPerChart)).optional(),
    period: z.string().max(60).optional(),
    rowCount: z.number().int().min(0).optional(),
  }),
  upsert_dashboard: z.object({
    category: categoryName,
    title: z.string().max(80).optional(),
    kpis: z.array(kpiSchema).min(1).max(LIMITS.maxKpis),
    charts: z.array(chartSchema).max(LIMITS.maxCharts).optional(),
    notes: z.array(z.string().max(160)).max(6).optional(),
    source: z.string().max(120).optional(),
  }),
  get_dashboard: z.object({ category: categoryName }),
  compose_overview: z.object({
    title: z.string().min(1).max(80),
    kpis: z.array(kpiSchema).min(1).max(6),
    charts: z.array(chartSchema).max(LIMITS.maxCharts).optional(),
    highlights: z.array(z.string().max(160)).max(6).optional(),
  }),
  register_monitor: z.object({
    name: z.string().min(1).max(60),
    category: categoryName,
    schedule: z.string().min(1).max(80),
    policy: policySchema,
    runner: z.enum(["local", "cloud"]),
  }),
  report_monitor_run: z.object({
    monitorId: z.string().min(1).max(60),
    findings: z.array(z.string().max(200)).max(20).default([]),
    drafts: z.array(draftInputSchema).max(20).default([]),
  }),
  list_monitors: emptyInput,
  get_run_log: z.object({
    monitorId: z.string().max(60).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  approve_draft: z.object({
    draftId: z.string().min(1).max(60),
    note: z.string().max(200).optional(),
  }),
  decline_draft: z.object({
    draftId: z.string().min(1).max(60),
    reason: z.string().max(200).optional(),
  }),
  set_policy: z.object({
    monitorId: z.string().min(1).max(60),
    policy: policySchema,
  }),
  seed_demo_workspace: emptyInput,
  clear_workspace: z.object({
    confirm: z.literal(true),
  }),
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
export type SeedDemoWorkspaceInput = ToolInputs["seed_demo_workspace"];
export type ClearWorkspaceInput = ToolInputs["clear_workspace"];
