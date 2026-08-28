/**
 * Public surface of the dataset module (owner A11).
 * Other modules import from here, never from the files. See ./INTEGRATION.md for the
 * five lines the orchestrator needs to wire the drop zone and the four tools.
 */

export { DropZone } from "./ui/DropZone";
export type { DropZoneProps } from "./ui/DropZone";
export { ProfileCard } from "./ui/ProfileCard";
export type { ProfileCardProps } from "./ui/ProfileCard";
export { useDatasets } from "./ui/useDatasets";

export { createDatasetHandlers, datasetHandlers } from "./handlers";
export type { DatasetHandlerMap } from "./handlers";
export {
  DATASET_READ_ONLY_TOOLS,
  DATASET_TOOL_DESCRIPTIONS,
  DATASET_UNTRUSTED_TOOLS,
  annotationsForDataset,
  createDatasetToolDefinitions,
  datasetToolDefinitions,
} from "./definitions";
export type { DatasetToolDefinition } from "./definitions";
export { datasetJsonSchemas } from "./jsonSchemas";
export type { JsonSchema } from "./jsonSchemas";
export {
  DATASET_TOOL_NAMES,
  datasetToolSchemas,
  filterOps,
  isDatasetToolName,
  metricOps,
} from "./schemas";
export type {
  AggregateDatasetInput,
  AttachDatasetInput,
  DatasetToolInputs,
  DatasetToolName,
  GetDatasetProfileInput,
  ListDatasetsInput,
} from "./schemas";

export { createDatasetRegistry, datasetMemory, MAX_DATASETS } from "./memory";
export type { DatasetRegistry } from "./memory";

/* Pure functions: profiling, masking, inference, aggregation, summary mapping. */
export { columnByName, maskedSample, profilePeriod, profileTable } from "./profile";
export type { ProfileOptions } from "./profile";
export {
  EMAIL_MASK,
  TEXT_MASK,
  cellHasEmail,
  looksLikeEmail,
  magnitudeBucket,
  maskDate,
  maskLabel,
  maskSample,
} from "./mask";
export {
  emptyTally,
  isBlank,
  looksLikeDate,
  toBoolean,
  toNumber,
  toTimestamp,
  typeFromTally,
} from "./infer";
export type { TypeTally } from "./infer";
export { AggregateError, aggregateTable, passesFilter } from "./aggregate";
export type { AggregateFilter, AggregateQuery } from "./aggregate";
export { describeStored, summaryFromProfile, summaryProvenance } from "./summary";
export { ROWS_NOTE, aggregateText, datasetListText, notLoadedText, profileText } from "./render";
export type { AggregateView } from "./render";
export {
  DatasetFileError,
  checkSize,
  formatBytes,
  normaliseHeaders,
  parseCsvText,
  parseFile,
  tableFromGrid,
} from "./parse";
export type { ParseOptions, ParsePhase, ParseProgress } from "./parse";

export { DATASET_LIMITS, PROVENANCE_SUFFIX, provenanceFor } from "./types";
export type {
  AggregatePoint,
  AggregateResult,
  CellValue,
  ColumnProfile,
  ColumnType,
  DatasetProfile,
  DatasetTable,
  DateRange,
  FilterOp,
  LoadedDataset,
  MaskedRow,
  MetricOp,
  NumericStats,
  ValueCount,
} from "./types";
