/**
 * Public surface of the rooms module: multiplayer boards over a relay that keeps nothing.
 *
 * Wiring instructions for the shell live in src/rooms/INTEGRATION.md. Nothing outside this
 * folder should import the files directly.
 *
 * Security, stated plainly and repeated in the UI copy:
 * - a room is unlisted, not private: the slug is the only thing between a link and the board;
 * - there is no auth in v1, so anyone holding the link can read and write everything on it;
 * - the relay is a broadcast channel with no table behind it, so it forwards and forgets;
 * - the shared board does include the audit rail, on purpose, because the people in a room
 *   are meant to see one trail; do not open a room on a board you would not show them.
 *
 * What a room is NOT open about is its content: every room this build opens is encrypted
 * end to end with a key that rides in the invite link's fragment (src/crypto), so the
 * relay carries sealed envelopes and can read nothing. The link is still the whole
 * credential: anyone holding it is in the room.
 */

export { ROOM_LIMITS, PATCH_KINDS } from "./types";
export type {
  PatchKind,
  PeerInfo,
  RoomMessage,
  RoomPatch,
  RoomStatus,
  RoomTransport,
  RoomTransportKind,
} from "./types";

export {
  ROOM_PARAM,
  ROOM_SLUG_LENGTH,
  ROOM_SLUG_PATTERN,
  currentRoomSlug,
  isRoomSlug,
  leaveRoomUrl,
  mintRoomSlug,
  readRoomSlug,
  roomJoinUrl,
  roomStoreKey,
} from "./slug";

export { byteLength, coerceAuditEvent, coerceMessage, coercePatch, coercePeer, encodeMessage } from "./wire";
export { boardSize, capAuditPatches, derivePatches, emptyLike, fullPatches, tooManyPatches } from "./diff";
export { applyNormalized, applyPatches, isFresh, mergeAudit, normalizePatches, noteLocal } from "./apply";
export type { ApplyResult, LwwClock, NormalPatch, NormalizeResult } from "./apply";

export { IDLE_PRESENCE, createPresenceController, presenceLabel } from "./presence";
export type { PresenceController, PresenceState, PresenceStore, RoomPeer } from "./presence";

export { roomSnapshot, snapshotPatches } from "./snapshot";
export type { RoomSnapshot } from "./snapshot";

export { chooseTransport, createMemoryHub, createNullTransport, createRoomTransport } from "./transport";
export { roomSecrets, sealedTransport } from "./sealed";
export type { RoomSecrets, SealedTransport } from "./sealed";
export type { TransportChoice } from "./transport";
export { createBroadcastTransport, channelName, hasBroadcastChannel } from "./broadcast";
export {
  broadcastFrame,
  createSupabaseTransport,
  heartbeatFrame,
  joinFrame,
  readFrame,
  readFramePayload,
  realtimeSocketUrl,
  roomTopic,
  supabaseRealtimeConfig,
} from "./supabase";
export type { SupabaseRealtimeConfig } from "./supabase";

export { ROOM_AUDIT_TOOL, mintClientId, startRoomSync } from "./sync";
export type { RoomRuntime, RoomSyncOptions } from "./sync";

export {
  configureRooms,
  createRoom,
  getRoomRuntime,
  inviteUrl,
  isJoinFailure,
  joinRoom,
  leaveRoom,
  resetRoomSecret,
  roomFingerprint,
  roomSecret,
  roomStorageKey,
  subscribeRoomRuntime,
} from "./runtime";
export type { JoinFailure, RoomHost } from "./runtime";

export {
  ROOM_READ_ONLY_TOOLS,
  ROOM_TOOL_NAMES,
  ROOM_UNTRUSTED_CONTENT_TOOLS,
  create_room,
  get_room,
  roomHandlers,
  roomJsonSchemas,
  roomToolDescriptions,
  roomToolSchemas,
} from "./handlers";
export type { RoomHandler, RoomHandlerResult, RoomToolName } from "./handlers";

export { usePresence, usePresenceLabel } from "./usePresence";
