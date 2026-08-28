# Wiring the dataset module (owner A11)

1. **Board**: render `<DropZone />` from `src/dataset` above the category grid in
   `src/shell/tabs/board/Board.tsx`, hidden when `readOnly` (a shared snapshot has no rows).
2. **Schemas (required)**: spread `datasetToolSchemas` into `toolSchemas` (`src/webmcp/schemas.ts`) and
   `datasetJsonSchemas` into `jsonSchemas` (`src/webmcp/jsonSchemas.ts`); the registry only runs names it knows.
3. **Handlers**: spread `datasetHandlers` into the map passed to `createToolRegistry`
   (`{ ...workspaceHandlers, ...monitorHandlers, ...datasetHandlers }`).
4. **Definitions**: either add `DATASET_TOOL_DESCRIPTIONS` to `DESCRIPTIONS` and the two
   `DATASET_*_TOOLS` arrays to `src/webmcp/annotations.ts`, or register
   `createDatasetToolDefinitions(registry)` alongside `createToolDefinitions(registry)`.
5. Nothing else: rows live in `datasetMemory`, a module-level Map that dies with the tab, never in the store.
