/**
 * Hand written JSON Schema for every tool input, mirroring src/webmcp/schemas.ts.
 * WebMCP wants plain JSON Schema in registerTool and we ship no zod-to-json converter,
 * so these stay in step with the zod shapes by review. Parameter descriptions stay
 * under 150 chars (LIMITS.paramDescriptionChars).
 */

import { LIMITS } from "../types";
import { capabilityJsonSchemas } from "../capabilities/tools";
import { datasetJsonSchemas } from "../dataset/jsonSchemas";
import { roomJsonSchemas } from "../rooms/handlers";
import { turnJsonSchemas } from "../turns/tools";
import { workspaceJsonSchemas } from "../workspaces/tools";
import { agentJsonSchemas } from "../agents/tools";
import { loopJsonSchemas } from "../loops/tools";
import { purposeJsonSchemas } from "../purpose/tools";
import type { ToolName } from "./schemas";

export type JsonSchema = Record<string, unknown>;

const text = (max: number, description: string, min = 0): JsonSchema => ({
  type: "string",
  ...(min > 0 ? { minLength: min } : {}),
  maxLength: max,
  description,
});

const object = (
  properties: Record<string, JsonSchema>,
  required: readonly string[] = [],
): JsonSchema => ({
  type: "object",
  properties,
  ...(required.length > 0 ? { required: [...required] } : {}),
  additionalProperties: false,
});

const list = (
  items: JsonSchema,
  maxItems: number,
  description: string,
  minItems = 0,
): JsonSchema => ({
  type: "array",
  items,
  ...(minItems > 0 ? { minItems } : {}),
  maxItems,
  description,
});

const numberMap = (description: string): JsonSchema => ({
  type: "object",
  additionalProperties: { type: "number" },
  description,
});

const EMPTY: JsonSchema = { type: "object", properties: {}, additionalProperties: false };

const kpi: JsonSchema = object(
  {
    label: text(40, "Short KPI label, for example Open invoices.", 1),
    value: {
      anyOf: [{ type: "string", maxLength: 40 }, { type: "number" }],
      description: "The number itself, or a preformatted string such as EUR 12.4k.",
    },
    delta: text(20, "Change against the previous period, for example +12%."),
    hint: text(80, "One line of context shown under the value."),
  },
  ["label", "value"],
);

const chartPoint: JsonSchema = object(
  {
    label: text(40, "Point label, for example Week 34 or Unpaid.", 1),
    value: { type: "number", description: "Numeric value for this point." },
    series: text(30, "Series name when one chart carries several lines or bars."),
  },
  ["label", "value"],
);

const chart: JsonSchema = object(
  {
    id: text(40, "Stable id so a later call can replace this chart."),
    kind: { type: "string", enum: ["bar", "line", "donut", "table"], description: "Chart type." },
    title: text(80, "Chart title.", 1),
    points: list(
      chartPoint,
      LIMITS.maxPointsPerChart,
      "Aggregated points. Extra points are dropped, never sampled.",
    ),
    columns: list(text(40, "Column header."), 8, "Table column headers, used with rows for kind table."),
    rows: list(
      {
        type: "array",
        items: { anyOf: [{ type: "string", maxLength: 60 }, { type: "number" }] },
        maxItems: 8,
      },
      LIMITS.maxTableRows,
      "Table rows aligned to columns. Aggregates only, never raw records.",
    ),
    note: text(160, "Footnote under the chart, for example the source or the period."),
  },
  ["kind", "title"],
);

const threshold: JsonSchema = object(
  {
    field: text(40, "Draft field to test, for example amount.", 1),
    op: {
      type: "string",
      enum: ["gt", "gte", "lt", "lte", "eq"],
      description: "Comparison operator.",
    },
    value: { type: "number", description: "Value compared against the draft field." },
    label: text(60, "Clause name shown to the human when this threshold holds a draft."),
  },
  ["field", "op", "value"],
);

const policy: JsonSchema = object(
  {
    maxAutoActionsPerRun: {
      type: "integer",
      minimum: 0,
      maximum: 50,
      description: "How many drafts one run may auto approve. 0 sends everything to a human.",
    },
    thresholds: list(threshold, 10, "Rules that hold a draft for a human and name the clause."),
    allowlist: list(
      text(60, "Draft kind or target that may auto approve."),
      50,
      "Kinds or targets allowed to auto approve.",
    ),
    denylist: list(
      text(60, "Draft kind or target that is always held."),
      50,
      "Kinds or targets that are always held.",
    ),
    requireHumanFor: list(
      text(60, "Draft kind that always needs a human."),
      20,
      "Draft kinds that always need a human decision.",
    ),
    notes: text(300, "Plain language note shown next to the policy in the UI."),
  },
  ["maxAutoActionsPerRun"],
);

const draft: JsonSchema = object(
  {
    kind: text(40, "Action kind, for example send_reminder or flag_review.", 1),
    target: text(80, "What the action touches, for example invoice INV-1043.", 1),
    summary: text(200, "One line a human can approve or decline without opening anything.", 1),
    amount: { type: "number", description: "Money or quantity the action moves, tested by policy." },
    fields: {
      type: "object",
      additionalProperties: { anyOf: [{ type: "string", maxLength: 120 }, { type: "number" }] },
      description: "Extra fields policy thresholds can test, for example days_overdue.",
    },
  },
  ["kind", "target", "summary"],
);

const categoryName = text(60, "Category name, for example Invoices. Case sensitive, used as the key.", 1);

const feedbackTarget: JsonSchema = object(
  {
    kind: {
      type: "string",
      enum: ["dashboard", "overview", "draft", "monitor", "agent", "room", "person"],
      description: "A board object, an agent by caller name, a person by name, or the room.",
    },
    id: text(80, "Category name, the word overview, a draft or monitor id, a caller or person name, or * for anyone.", 1),
  },
  ["kind", "id"],
);

/** The stamp a read returned, so a write built on a stale copy is refused, not applied. */
const expectedUpdatedAt: JsonSchema = text(
  40,
  "The updatedAt you last read for this object. The write is refused if it changed since.",
);

/** The one field every tool shares, so parallel sub-agents show up by name in the rail. */
const caller: JsonSchema = text(
  LIMITS.maxCallerChars,
  "Name of the agent or sub-agent making this call, shown in the activity rail.",
  1,
);

const baseSchemas: Record<ToolName, JsonSchema> = {
  get_workspace: EMPTY,
  create_category: object(
    {
      name: categoryName,
      description: text(300, "What this category covers, shown on the card."),
      provenance: text(200, "Where the numbers come from, for example Finance export 2026-08."),
    },
    ["name"],
  ),
  upsert_dataset_summary: object(
    {
      category: categoryName,
      counts: numberMap("Named counts, for example open 42 and overdue 7."),
      sums: numberMap("Named sums, for example open_value 128400."),
      top: {
        type: "object",
        additionalProperties: list(
          object(
            {
              label: text(40, "Item label.", 1),
              value: { type: "number", description: "Item value." },
            },
            ["label", "value"],
          ),
          LIMITS.maxPointsPerChart,
          "Top items for this dimension.",
        ),
        description: "Top lists by dimension, for example by_customer with label and value pairs.",
      },
      period: text(60, "Period the aggregates cover, for example 2026-Q3."),
      rowCount: {
        type: "integer",
        minimum: 0,
        description: "How many source rows were aggregated. The rows themselves stay with you.",
      },
    },
    ["category"],
  ),
  upsert_dashboard: object(
    {
      category: categoryName,
      title: text(80, "Dashboard title. Defaults to the category name."),
      kpis: list(kpi, LIMITS.maxKpis, "KPI row, one to four cards.", 1),
      charts: list(chart, LIMITS.maxCharts, "Up to four charts rendered under the KPIs."),
      notes: list(text(160, "One note line."), 6, "Short notes shown under the charts."),
      source: text(120, "Where this view came from, shown as provenance."),
      expectedUpdatedAt,
    },
    ["category", "kpis"],
  ),
  get_dashboard: object({ category: categoryName }, ["category"]),
  compose_overview: object(
    {
      title: text(80, "Overview title shown on the first tab.", 1),
      kpis: list(kpi, 6, "Cross category KPI row, one to six cards.", 1),
      charts: list(chart, LIMITS.maxCharts, "Up to four charts for the overview."),
      highlights: list(text(160, "One highlight line."), 6, "Short lines a human should read first."),
      expectedUpdatedAt,
    },
    ["title", "kpis"],
  ),
  register_monitor: object(
    {
      name: text(60, "Monitor name, for example Overdue invoices.", 1),
      category: categoryName,
      schedule: text(80, "Cron string, or plain English such as every morning 08:00.", 1),
      policy,
      runner: {
        type: "string",
        enum: ["local", "cloud"],
        description: "Where the run happens: this browser, or a scheduled task.",
      },
    },
    ["name", "category", "schedule", "policy", "runner"],
  ),
  report_monitor_run: object(
    {
      monitorId: text(60, "Id returned by register_monitor.", 1),
      findings: list(text(200, "One finding line."), 20, "What the run found, in plain language."),
      drafts: list(draft, 20, "Proposed actions. Policy decides auto, pending or held."),
    },
    ["monitorId"],
  ),
  list_monitors: EMPTY,
  get_run_log: object({
    monitorId: text(60, "Limit the log to one monitor. Omit for every monitor."),
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 20,
      description: "How many runs to return, newest first. Default 5.",
    },
  }),
  approve_draft: object(
    {
      draftId: text(60, "Id from report_monitor_run or get_run_log.", 1),
      note: text(200, "Why this is safe to approve. Stored in the audit trail."),
    },
    ["draftId"],
  ),
  decline_draft: object(
    {
      draftId: text(60, "Id from report_monitor_run or get_run_log.", 1),
      reason: text(200, "Why the draft was declined. Stored in the audit trail."),
    },
    ["draftId"],
  ),
  set_policy: object(
    { monitorId: text(60, "Id returned by register_monitor.", 1), policy, expectedUpdatedAt },
    ["monitorId", "policy"],
  ),
  add_feedback: object(
    {
      target: feedbackTarget,
      text: text(
        LIMITS.maxFeedbackChars,
        "The request in plain language. Everybody on this board reads it on the page.",
        1,
      ),
    },
    ["target", "text"],
  ),
  list_feedback: object({
    target: feedbackTarget,
    includeResolved: {
      type: "boolean",
      description: "Include notes already resolved. Default false, open notes only.",
    },
  }),
  resolve_feedback: object(
    {
      feedbackId: text(60, "Id from list_feedback.", 1),
      resolution: text(200, "What you changed in response. Shown to the human who left the note.", 1),
    },
    ["feedbackId", "resolution"],
  ),
  share_board: EMPTY,
  clear_workspace: object(
    {
      confirm: {
        type: "boolean",
        enum: [true],
        description: "Must be true. Guards against an accidental wipe.",
      },
    },
    ["confirm"],
  ),
  ...roomJsonSchemas,
  ...datasetJsonSchemas,
  ...turnJsonSchemas,
  ...capabilityJsonSchemas,
  ...workspaceJsonSchemas,
  ...agentJsonSchemas,
  ...loopJsonSchemas,
  ...purposeJsonSchemas,
};

/** caller is added once here so no tool can forget it. */
function withCaller(schema: JsonSchema): JsonSchema {
  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
  return { ...schema, properties: { ...properties, caller } };
}

export const jsonSchemas: Record<ToolName, JsonSchema> = Object.fromEntries(
  Object.entries(baseSchemas).map(([name, schema]) => [name, withCaller(schema)]),
) as Record<ToolName, JsonSchema>;
