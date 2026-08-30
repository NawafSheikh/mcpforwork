/**
 * Public surface of the agents module: who an agent is in this room.
 *
 * Import the leaf files from anything that must stay free of React; src/webmcp merges
 * ./tools the same way it merges the room, dataset, turn, capability and workspace tools.
 */

export {
  BARE_VENDOR_NAMES,
  agentNames,
  grantName,
  heldName,
  isBareVendorName,
  resetIdentity,
  setHeldName,
} from "./identity";

export {
  AGENT_READ_ONLY_TOOLS,
  AGENT_TOOL_NAMES,
  AGENT_UNTRUSTED_TOOLS,
  agentHandlers,
  agentJsonSchemas,
  agentToolDescriptions,
  agentToolSchemas,
} from "./tools";
export type { AgentHandler, AgentHandlerResult, AgentToolName } from "./tools";
