/**
 * JSON Schema for the four dataset tools (owner A11), mirroring ./schemas.ts by review,
 * exactly as src/webmcp/jsonSchemas.ts does for the rest of the contract. WebMCP wants
 * plain JSON Schema in registerTool and this repo ships no zod-to-json converter.
 * Parameter descriptions stay under LIMITS.paramDescriptionChars.
 */

import { LIMITS } from "../types";
import { filterOps, metricOps, type DatasetToolName } from "./schemas";

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

const EMPTY: JsonSchema = { type: "object", properties: {}, additionalProperties: false };

const caller: JsonSchema = text(
  LIMITS.maxCallerChars,
  "Name of the agent or sub-agent making this call, shown in the activity rail.",
  1,
);

const datasetRef = text(120, "File name from list_datasets, for example invoices_q3.csv.", 1);
const columnName = text(80, "Column name exactly as get_dataset_profile spells it.", 1);

const metric: JsonSchema = object(
  {
    column: columnName,
    op: {
      type: "string",
      enum: [...metricOps],
      description: "count is rows with a value; sum, mean, min and max need a numeric column.",
    },
  },
  ["column", "op"],
);

const filter: JsonSchema = object(
  {
    column: columnName,
    op: {
      type: "string",
      enum: [...filterOps],
      description: "eq, neq and contains compare as text; gt and lt compare as numbers.",
    },
    value: {
      anyOf: [{ type: "string", maxLength: 120 }, { type: "number" }, { type: "boolean" }],
      description: "Value to compare each cell against.",
    },
  },
  ["column", "op", "value"],
);

const baseSchemas: Record<DatasetToolName, JsonSchema> = {
  list_datasets: EMPTY,
  get_dataset_profile: object({ dataset: datasetRef }, ["dataset"]),
  aggregate_dataset: object(
    {
      dataset: datasetRef,
      groupBy: columnName,
      metric,
      top: {
        type: "integer",
        minimum: 1,
        maximum: LIMITS.maxPointsPerChart,
        description: `How many groups to return, 1 to ${LIMITS.maxPointsPerChart}. Defaults to ${LIMITS.maxPointsPerChart}.`,
      },
      filter,
    },
    ["dataset", "groupBy", "metric"],
  ),
  attach_dataset_to_category: object(
    {
      dataset: datasetRef,
      category: text(60, "Category to store the profile under. Created if it does not exist.", 1),
    },
    ["dataset", "category"],
  ),
};

function withCaller(schema: JsonSchema): JsonSchema {
  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
  return { ...schema, properties: { ...properties, caller } };
}

export const datasetJsonSchemas: Record<DatasetToolName, JsonSchema> = Object.fromEntries(
  Object.entries(baseSchemas).map(([name, schema]) => [name, withCaller(schema)]),
) as Record<DatasetToolName, JsonSchema>;
