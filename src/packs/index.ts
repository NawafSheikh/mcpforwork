/**
 * Public surface of the tool packs module (docs/PACKS.md, owner A20).
 *
 * What an agent may do in this room is decided on the page: six built-in packs with a
 * switch each, a local bridge that turns a machine's own tools into more packs, and a
 * catalog of the work packs still to come. Mount points are in src/packs/INTEGRATION.md.
 *
 * Import the leaf files, not this barrel, from anything that must stay free of React:
 * src/webmcp/registry.ts takes `packOffText` from ./registry, and src/rooms/apply.ts
 * takes `coercePackState` from ./coerce.
 */

export {
  BUILT_IN_PACKS,
  PACK_IDS,
  PACK_TOOL_NAMES,
  defaultEnabled,
  isPackId,
  packById,
  packOffText,
  packOfTool,
  packRiskLabel,
} from "./registry";
export type { PackDefinition, PackId } from "./registry";

export { coercePackState } from "./coerce";

export {
  changedByText,
  enabledPackIds,
  packEnabled,
  packStateOf,
  packView,
  packViews,
  setPackState,
} from "./state";
export type { PackView, SetPackInput } from "./state";

export { createPackController } from "./controller";
export type { PackController } from "./controller";

export {
  NOT_HOST_REASON,
  firstPeerId,
  hostLabel,
  inRoom,
  maySwitchPacks,
  roomHostId,
  subscribeHost,
  switchBlockedReason,
} from "./host";

export { usePacks } from "./usePacks";
export type { PacksApi } from "./usePacks";

export { PacksPanel } from "./ui/PacksPanel";
export { BridgeSection } from "./ui/BridgeSection";

export {
  BridgeClient,
  DEFAULT_BRIDGE_URL,
  DISCONNECTED,
  acceptPacks,
  refusalFor,
} from "./bridge";
export type {
  Accepted,
  BridgeEvent,
  BridgeHello,
  BridgeIdentity,
  BridgePack,
  BridgeRisk,
  BridgeToolSpec,
  CallOutcome,
  RobotProfile,
  SocketFactory,
  SocketLike,
} from "./bridge";

export { helloPayload, verdictText, verifyHello } from "./bridgeIdentity";
export type { IdentityVerdict } from "./bridgeIdentity";

export { createBridgeSession, eventText, localBridge, resetLocalBridge } from "./bridgeSession";
export type {
  BridgePackView,
  BridgeSession,
  BridgeSessionOptions,
  BridgeState,
  BridgeStatus,
} from "./bridgeSession";

export { useBridge } from "./useBridge";
export type { BridgeApi } from "./useBridge";

export { askCapability, emitPackToast, packToasts } from "./events";
export type { AskRequest, Bus, PackToast, ToastTone } from "./events";

export { WORK_PACKS, catalogStatusText } from "./catalog";
export type { CatalogEntry, CatalogStatus } from "./catalog";
