/**
 * Sessions: what was already running when the board opened, and what became of each one.
 *
 * The bridge lists; a person picks; the agent rules. src/sessions/state.ts holds the
 * board's side of that, tools.ts is the four tools it happens through, and nothing here
 * can start or stop anything on anybody's machine.
 */
export {
  attach,
  detach,
  listOutside,
  listSessions,
  noteOutside,
  place,
  placedAs,
  sessionById,
  sessionHosts,
  unplaced,
} from "./state";
export {
  SESSION_READ_ONLY_TOOLS,
  SESSION_TOOL_NAMES,
  SESSION_UNTRUSTED_TOOLS,
  sessionHandlers,
  sessionJsonSchemas,
  sessionToolDescriptions,
  sessionToolSchemas,
} from "./tools";
export type { SessionHandler, SessionHandlerResult, SessionToolName } from "./tools";
