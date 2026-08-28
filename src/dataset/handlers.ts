/**
 * The four dataset tools (owner A11), written against the exact handler signature in
 * src/webmcp/registry.ts: (validated input, current workspace) -> {next?, result}.
 *
 * Three are read only and touch the workspace not at all; they read the in-memory
 * registry, which is where the dropped file lives and dies. The fourth writes the
 * PROFILE onto a category. No handler can reach a row: aggregateTable is the only door
 * to the table and it returns at most twelve masked, labelled points.
 */

import { LIMITS, type Category, type Workspace } from "../types";
import type { ToolHandler } from "../webmcp/registry";
import { AggregateError, aggregateTable } from "./aggregate";
import { datasetMemory, type DatasetRegistry } from "./memory";
import { columnByName } from "./profile";
import { aggregateText, datasetListText, notLoadedText, profileText } from "./render";
import { describeStored, summaryFromProfile, summaryProvenance } from "./summary";
import type {
  AggregateDatasetInput,
  AttachDatasetInput,
  DatasetToolInputs,
  DatasetToolName,
  GetDatasetProfileInput,
  ListDatasetsInput,
} from "./schemas";
import type { ColumnProfile, DatasetProfile } from "./types";

export type DatasetHandlerMap = {
  readonly [K in DatasetToolName]: ToolHandler<DatasetToolInputs[K]>;
};

const known = (registry: DatasetRegistry): readonly string[] =>
  registry.profiles().map((profile) => profile.name);

const metricLabel = (input: AggregateDatasetInput): string =>
  `${input.metric.op}(${input.metric.column})`;

/** A category is created on demand, exactly as create_category would have made it. */
function upsertCategory(ws: Workspace, name: string, patch: Partial<Category>): Workspace {
  const existing = ws.categories[name];
  const merged: Category = {
    name,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    description: patch.description ?? existing?.description,
    provenance: patch.provenance ?? existing?.provenance,
    summary: patch.summary ?? existing?.summary,
    dashboard: patch.dashboard ?? existing?.dashboard,
  };
  return { ...ws, categories: { ...ws.categories, [name]: merged } };
}

const atCap = (ws: Workspace, name: string): boolean =>
  ws.categories[name] === undefined && Object.keys(ws.categories).length >= LIMITS.maxCategories;

/** Refusals the agent can act on, rather than a thrown error it cannot. */
function refuseMetric(column: ColumnProfile | undefined, input: AggregateDatasetInput): string | undefined {
  if (column === undefined) {
    return `Unknown metric column "${input.metric.column}". Call get_dataset_profile for the column names.`;
  }
  if (input.metric.op !== "count" && column.numeric === undefined) {
    return `Column "${column.name}" is ${column.type}, so ${input.metric.op} has nothing to add up. Use op count, or pick a column typed number.`;
  }
  return undefined;
}

function refuseGroup(column: ColumnProfile | undefined, input: AggregateDatasetInput): string | undefined {
  if (column === undefined) {
    return `Unknown groupBy column "${input.groupBy}". Call get_dataset_profile for the column names.`;
  }
  if (column.hasEmails === true) {
    return `Refused: "${column.name}" holds email addresses, so grouping by it would hand you one row per person. Group by a column that describes a category instead.`;
  }
  return undefined;
}

export function createDatasetHandlers(registry: DatasetRegistry = datasetMemory): DatasetHandlerMap {
  const profileOf = (name: string): DatasetProfile | undefined => registry.find(name)?.profile;

  const listDatasets: ToolHandler<ListDatasetsInput> = () => ({
    result: datasetListText(registry.profiles(), LIMITS.toolOutputChars),
  });

  const getDatasetProfile: ToolHandler<GetDatasetProfileInput> = (input) => {
    const profile = profileOf(input.dataset);
    if (!profile) return { result: notLoadedText(input.dataset, known(registry)) };
    return { result: profileText(profile, LIMITS.toolOutputChars) };
  };

  const aggregateDataset: ToolHandler<AggregateDatasetInput> = (input) => {
    const entry = registry.find(input.dataset);
    if (!entry) return { result: notLoadedText(input.dataset, known(registry)) };
    const refusal =
      refuseGroup(columnByName(entry.profile, input.groupBy), input) ??
      refuseMetric(columnByName(entry.profile, input.metric.column), input);
    if (refusal) return { result: refusal };
    try {
      const result = aggregateTable(entry.table, {
        groupBy: input.groupBy,
        metric: input.metric,
        ...(input.top === undefined ? {} : { top: input.top }),
        ...(input.filter === undefined ? {} : { filter: input.filter }),
      });
      const view = {
        dataset: entry.profile.name,
        groupBy: input.groupBy,
        metric: metricLabel(input),
        result,
        filtered: input.filter !== undefined,
      };
      return { result: aggregateText(view, LIMITS.toolOutputChars) };
    } catch (error) {
      if (error instanceof AggregateError) return { result: error.message };
      throw error;
    }
  };

  const attachDataset: ToolHandler<AttachDatasetInput> = (input, ws) => {
    const profile = profileOf(input.dataset);
    if (!profile) return { result: notLoadedText(input.dataset, known(registry)) };
    if (atCap(ws, input.category)) {
      return {
        result: `Refused: this workspace already holds ${LIMITS.maxCategories} categories. Reuse one or call clear_workspace first.`,
      };
    }
    const summary = summaryFromProfile(profile);
    const provenance = summaryProvenance(profile);
    const next = upsertCategory(ws, input.category, { summary, provenance });
    return {
      next,
      result: `Stored the profile of ${profile.name} on ${input.category}: ${describeStored(summary)}, ${profile.rowCount} source rows. Provenance: ${provenance}. The rows themselves stayed in the browser; call aggregate_dataset for chart points.`,
    };
  };

  return {
    list_datasets: listDatasets,
    get_dataset_profile: getDatasetProfile,
    aggregate_dataset: aggregateDataset,
    attach_dataset_to_category: attachDataset,
  };
}

/** The map the orchestrator spreads into the registry's HandlerMap. */
export const datasetHandlers: DatasetHandlerMap = createDatasetHandlers();
