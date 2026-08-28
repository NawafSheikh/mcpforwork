/**
 * Zod schemas for the four dataset tools (owner A11).
 * Module local by design: A2 owns src/webmcp/schemas.ts, so the orchestrator spreads
 * datasetToolSchemas into toolSchemas rather than this file reaching across.
 * Shapes follow the same conventions: every tool carries the optional caller, unknown
 * keys are stripped rather than rejected, and every string is bounded.
 */

import { z } from "zod";
import { LIMITS } from "../types";

const callerSchema = z.string().min(1).max(LIMITS.maxCallerChars).optional();

const tool = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, caller: callerSchema });

/** The file name the human dropped, or the dataset id from list_datasets. */
const datasetRef = z.string().min(1).max(120);
const columnName = z.string().min(1).max(80);

export const metricOps = ["count", "sum", "mean", "min", "max"] as const;
export const filterOps = ["eq", "neq", "gt", "lt", "contains"] as const;

export const metricSchema = z.object({
  column: columnName,
  op: z.enum(metricOps),
});

export const filterSchema = z.object({
  column: columnName,
  op: z.enum(filterOps),
  value: z.union([z.string().max(120), z.number(), z.boolean()]),
});

export const datasetToolSchemas = {
  list_datasets: tool({}),
  get_dataset_profile: tool({ dataset: datasetRef }),
  aggregate_dataset: tool({
    dataset: datasetRef,
    groupBy: columnName,
    metric: metricSchema,
    top: z.number().int().min(1).max(LIMITS.maxPointsPerChart).optional(),
    filter: filterSchema.optional(),
  }),
  attach_dataset_to_category: tool({
    dataset: datasetRef,
    category: z.string().min(1).max(60),
  }),
} as const;

export type DatasetToolName = keyof typeof datasetToolSchemas;
export type DatasetToolInputs = {
  [K in DatasetToolName]: z.infer<(typeof datasetToolSchemas)[K]>;
};

export const DATASET_TOOL_NAMES = Object.keys(datasetToolSchemas) as readonly DatasetToolName[];

export function isDatasetToolName(name: string): name is DatasetToolName {
  return Object.prototype.hasOwnProperty.call(datasetToolSchemas, name);
}

export type ListDatasetsInput = DatasetToolInputs["list_datasets"];
export type GetDatasetProfileInput = DatasetToolInputs["get_dataset_profile"];
export type AggregateDatasetInput = DatasetToolInputs["aggregate_dataset"];
export type AttachDatasetInput = DatasetToolInputs["attach_dataset_to_category"];
