/**
 * Public surface of the capabilities module (docs/PACKS.md, owner A20).
 *
 * Every person, agent and robot in the room has a card: the site packs on for them, the
 * tools they say they have locally, and a line on what they know. A card is a
 * description, never a permission. Agents read them to find who has access to a system
 * before asking for it.
 *
 * Import the leaf files from anything that must stay free of React: src/rooms/apply.ts
 * takes `coerceCapability` from ./coerce, and src/webmcp merges ./tools.
 */

export { capabilityKey, coerceCapability } from "./coerce";

export { capabilityFor, capabilityLine, listCapabilities, publishCapability } from "./state";

export {
  CAPABILITY_READ_ONLY_TOOLS,
  CAPABILITY_TOOL_NAMES,
  CAPABILITY_UNTRUSTED_TOOLS,
  capabilityHandlers,
  capabilityJsonSchemas,
  capabilityToolDescriptions,
  capabilityToolSchemas,
} from "./tools";
export type { CapabilityHandler, CapabilityHandlerResult, CapabilityToolName } from "./tools";

export { useCapabilities, useCapability } from "./useCapabilities";
export type { CapabilitiesApi } from "./useCapabilities";

export { CapabilityCard, askText } from "./ui/CapabilityCard";
export { CapabilityCards } from "./ui/CapabilityCards";
