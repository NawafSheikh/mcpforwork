/**
 * The published contract: budgets and annotations. These are the parts an integrator
 * cannot see by reading a handler, so they are asserted rather than reviewed.
 */
import { describe, expect, it } from "vitest";
import { LIMITS } from "../../types";
import { DATASET_TOOL_NAMES, datasetJsonSchemas, datasetToolDefinitions } from "../index";
import { datasetHandlers } from "../handlers";

const MAX_TOOL_DESCRIPTION = 350;

function descriptions(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) descriptions(item, found);
    return found;
  }
  if (typeof node !== "object" || node === null) return found;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "description" && typeof value === "string") found.push(value);
    else descriptions(value, found);
  }
  return found;
}

describe("definition budgets", () => {
  it("keeps every tool description under 350 characters", () => {
    for (const definition of datasetToolDefinitions) {
      expect(
        definition.description.length,
        `${definition.name} is ${definition.description.length}`,
      ).toBeLessThan(MAX_TOOL_DESCRIPTION);
    }
  });

  it("keeps every parameter description inside LIMITS.paramDescriptionChars", () => {
    for (const definition of datasetToolDefinitions) {
      for (const text of descriptions(definition.inputSchema)) {
        expect(text.length, `${definition.name}: ${text}`).toBeLessThanOrEqual(
          LIMITS.paramDescriptionChars,
        );
      }
    }
  });
});

describe("annotations", () => {
  it("marks the three reading tools read only and their content untrusted", () => {
    const byName = Object.fromEntries(
      datasetToolDefinitions.map((definition) => [definition.name, definition.annotations]),
    );
    const reading = { readOnlyHint: true, untrustedContentHint: true };
    expect(byName["list_datasets"]).toEqual(reading);
    expect(byName["get_dataset_profile"]).toEqual(reading);
    expect(byName["aggregate_dataset"]).toEqual(reading);
  });

  it("marks the one writing tool as neither", () => {
    const attach = datasetToolDefinitions.find(
      (definition) => definition.name === "attach_dataset_to_category",
    );
    expect(attach?.annotations).toEqual({ readOnlyHint: false, untrustedContentHint: false });
  });
});

describe("the four names line up everywhere", () => {
  it("has a schema, a JSON schema, a definition and a handler for each", () => {
    expect(DATASET_TOOL_NAMES).toEqual([
      "list_datasets",
      "get_dataset_profile",
      "aggregate_dataset",
      "attach_dataset_to_category",
    ]);
    for (const name of DATASET_TOOL_NAMES) {
      expect(datasetJsonSchemas[name], name).toBeDefined();
      expect(datasetHandlers[name], name).toBeTypeOf("function");
      expect(
        datasetToolDefinitions.some((definition) => definition.name === name),
        name,
      ).toBe(true);
    }
  });

  it("accepts the optional caller on every tool, as the registry expects", () => {
    for (const name of DATASET_TOOL_NAMES) {
      const properties = datasetJsonSchemas[name].properties as Record<string, unknown>;
      expect(properties["caller"], name).toBeDefined();
    }
  });
});
