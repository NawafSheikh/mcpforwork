/**
 * Invite links: one thing a person clicks, one thing they paste.
 *
 * Shape: https://host/path?room=<slug>#k=<secret>&r=<role>
 *
 * The slug stays in the query because the app has to know which room to join before any
 * key work happens, and the secret stays in the fragment because no browser sends a
 * fragment to a server. A relay operator reading every request sees the slug and never
 * the key. Nothing else about the link needs explaining to the person sending it.
 *
 * The role is a hint, not a permission. In v1 both roles carry the same key, so a "read"
 * link is a UI promise that this browser will not write, and a determined holder of it can
 * still write. Signing keys are the fix and they are not in v1: docs/SECURITY.md says so
 * in those words, and the UI must not claim more than that.
 *
 * ROOM_PARAM mirrors src/rooms/slug.ts. It is redeclared rather than imported so that
 * src/rooms can depend on src/crypto and never the other way round.
 */
import { isRoomSecret, readSecretFromFragment, writeSecretToFragment } from "./keys";
import { readFragmentParam, writeFragmentParam } from "./fragment";

export const ROOM_PARAM = "room";
export const ROLE_PARAM = "r";
const SLUG_PATTERN = /^[a-z0-9]{6,16}$/;

export type RoomRole = "write" | "read";

export interface RoomInvite {
  readonly slug: string;
  /** null when the link names a room but carries no key: the locked case. */
  readonly secret: string | null;
  readonly role: RoomRole;
  /** True when this browser cannot read the room because the link was trimmed. */
  readonly locked: boolean;
}

interface UrlParts {
  readonly head: string;
  readonly query: string;
  readonly hash: string;
}

function splitUrl(url: string): UrlParts {
  const hashAt = url.indexOf("#");
  const withoutHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : url.slice(hashAt);
  const queryAt = withoutHash.indexOf("?");
  return {
    head: queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt),
    query: queryAt === -1 ? "" : withoutHash.slice(queryAt + 1),
    hash,
  };
}

function isRole(value: unknown): value is RoomRole {
  return value === "read" || value === "write";
}

/**
 * A link for this room with this key. Other query parameters survive (mode=live), and the
 * fragment is rebuilt from scratch: a "#share=" snapshot must never ride along on a room
 * invite, because a link has to say "this is the live room" or "this is a frozen picture".
 */
export function buildInviteUrl(baseUrl: string, slug: string, secret: string, mode: RoomRole = "write"): string {
  if (!SLUG_PATTERN.test(slug)) throw new Error(`"${slug}" is not a room slug.`);
  if (!isRoomSecret(secret)) throw new Error("That room key is not a valid secret.");
  const parts = splitUrl(baseUrl);
  const params = new URLSearchParams(parts.query);
  params.set(ROOM_PARAM, slug);
  const query = params.toString();
  const hash = writeFragmentParam(writeSecretToFragment("", secret), ROLE_PARAM, mode);
  return `${parts.head}${query.length > 0 ? `?${query}` : ""}${hash}`;
}

/** null when the URL names no room. A room without a key parses fine and comes back locked. */
export function parseInvite(url: string): RoomInvite | null {
  const parts = splitUrl(url);
  const slug = new URLSearchParams(parts.query).get(ROOM_PARAM);
  if (slug === null || !SLUG_PATTERN.test(slug)) return null;
  const secret = readSecretFromFragment(parts.hash);
  const role = readFragmentParam(parts.hash, ROLE_PARAM);
  return {
    slug,
    secret,
    role: isRole(role) ? role : "write",
    locked: secret === null,
  };
}
