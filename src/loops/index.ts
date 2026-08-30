/**
 * Public surface of the loops module: the process table of this OS.
 *
 * A loop is something that keeps running on somebody's machine. It sits in a layer and
 * feeds a loop above it, so the picture reads bottom to top. Import the leaf files from
 * anything that must stay free of React; src/webmcp merges ./tools and src/rooms takes
 * ./coerce, the same way every other module does it.
 */

export { coerceLoop } from "./coerce";

export {
  LOOP_STATES,
  clampLayer,
  dropLoop,
  feedRefusal,
  feeders,
  findLoop,
  hosts,
  layers,
  listLoops,
  loopById,
  loopId,
  loopLine,
  loopRecord,
  putLoop,
  withRecord,
} from "./state";

export {
  LOOP_READ_ONLY_TOOLS,
  LOOP_TOOL_NAMES,
  LOOP_UNTRUSTED_TOOLS,
  loopHandlers,
  loopJsonSchemas,
  loopToolDescriptions,
  loopToolSchemas,
} from "./tools";
export type { LoopHandler, LoopHandlerResult, LoopToolName } from "./tools";
