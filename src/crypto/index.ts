/**
 * End to end encrypted rooms. The key is in the invite link's fragment, it never reaches
 * the relay or any server, and a peer without it sees ciphertext and nothing else.
 *
 * Encryption is not a setting. A new room mints a secret, the invite carries it, and the
 * only thing a person does is click Invite and send the link. How src/rooms wraps its
 * transport with this is in src/crypto/INTEGRATION.md; the honest threat model, including
 * what this does not defend against, is in docs/SECURITY.md.
 *
 * Nothing in this folder imports another feature folder, so src/rooms can depend on it
 * without a cycle, and nothing here touches the DOM, the store or IndexedDB.
 */

export { fromBase64url, toBase64url, toHex } from "./base64url";

export {
  FINGERPRINT_CHARS,
  ROOM_SECRET_BYTES,
  SECRET_PARAM,
  deriveRoomKey,
  fingerprint,
  generateRoomSecret,
  isRoomSecret,
  readSecretFromFragment,
  writeSecretToFragment,
} from "./keys";

export {
  dropFragmentParam,
  formatFragment,
  parseFragment,
  readFragmentParam,
  writeFragmentParam,
} from "./fragment";
export type { FragmentParam } from "./fragment";

export { ENVELOPE_VERSION, isEnvelope, open, seal } from "./envelope";
export type { Envelope, SealContext } from "./envelope";

export { ROLE_PARAM, ROOM_PARAM, buildInviteUrl, parseInvite } from "./roomInvite";
export type { RoomInvite, RoomRole } from "./roomInvite";

export {
  ENCRYPTED_BADGE,
  LOCKED_ROOM_ACTION,
  LOCKED_ROOM_MESSAGE,
  inviteToast,
  lockBadgeLabel,
} from "./copy";
