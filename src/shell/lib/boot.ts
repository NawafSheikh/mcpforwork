/**
 * What a URL says about the room to open, decided once before anything renders.
 *
 * Two kinds of room, and the difference is one character after the "#":
 * - a link with a key (#k=) is an encrypted room, which is every room Invite mints;
 * - a link with a slug and no key is a PUBLIC room (docs/UI.md), unencrypted by design,
 *   which is how the showcase room on the landing page can be opened by a stranger.
 *
 * A public room is not a broken link, so this never refuses to boot: the page joins,
 * registers its site tools and says "Public room" in the top bar. The only locked state
 * left is a key that does not open the room, and the page can only learn that from the
 * relay, ten seconds in (see WRONG_KEY_MS).
 */
import { parseInvite, type RoomRole } from "../../crypto";

export type RoomKind = "none" | "public" | "encrypted";

export interface RoomBoot {
  readonly kind: RoomKind;
  readonly slug: string | null;
  /**
   * What the link says this browser is here to do. It is a hint, never a permission:
   * both roles carry the same key in v1 (docs/LIMITATIONS.md), so the page keeps the
   * promise the link made and does not pretend the relay is enforcing it.
   */
  readonly role: RoomRole;
  /** Present only for an encrypted room. */
  readonly secret?: string;
}

export function roomBoot(href: string): RoomBoot {
  const invite = parseInvite(href);
  if (invite === null) return { kind: "none", slug: null, role: "write" };
  if (invite.secret === null) return { kind: "public", slug: invite.slug, role: invite.role };
  return { kind: "encrypted", slug: invite.slug, role: invite.role, secret: invite.secret };
}
