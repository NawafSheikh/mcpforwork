/**
 * The link a person sends. One click to make it, one paste to use it, and the key never
 * leaves the fragment, so a relay operator reading every request never sees it.
 */
import { describe, expect, it } from "vitest";
import { buildInviteUrl, parseInvite } from "../roomInvite";
import { generateRoomSecret } from "../keys";
import { ENCRYPTED_BADGE, LOCKED_ROOM_ACTION, LOCKED_ROOM_MESSAGE, inviteToast, lockBadgeLabel } from "../copy";

const BASE = "https://mcpforwork.example/app";
const SLUG = "abc123xyz9";
const SHARE = "0eyJ2IjoxfQ";

describe("buildInviteUrl", () => {
  const secret = generateRoomSecret();

  it("puts the room in the query and the key in the fragment", () => {
    const url = buildInviteUrl(BASE, SLUG, secret, "write");
    expect(url).toBe(`${BASE}?room=${SLUG}#k=${secret}&r=write`);
    const [before] = url.split("#");
    expect(before).not.toContain(secret);
  });

  it("keeps the other query parameters a deployment cares about", () => {
    const url = buildInviteUrl(`${BASE}?mode=live&x=1`, SLUG, secret, "read");
    expect(url.startsWith(`${BASE}?mode=live&x=1&room=${SLUG}#`)).toBe(true);
    expect(parseInvite(url)?.role).toBe("read");
  });

  it("replaces a room already in the link rather than adding a second one", () => {
    const url = buildInviteUrl(`${BASE}?room=oldroom99`, SLUG, secret);
    expect(url.match(/room=/g)).toHaveLength(1);
    expect(parseInvite(url)?.slug).toBe(SLUG);
  });

  it("drops a share snapshot, because a link is a live room or a frozen picture, not both", () => {
    const url = buildInviteUrl(`${BASE}#share=${SHARE}`, SLUG, secret);
    expect(url).not.toContain("share=");
    expect(parseInvite(url)?.secret).toBe(secret);
  });

  it("refuses a slug or a secret that is not one", () => {
    expect(() => buildInviteUrl(BASE, "NOPE", secret)).toThrow(/room slug/);
    expect(() => buildInviteUrl(BASE, SLUG, "nope")).toThrow(/valid secret/);
  });

  it("defaults to a write invite, which is what the Invite button sends", () => {
    expect(parseInvite(buildInviteUrl(BASE, SLUG, secret))?.role).toBe("write");
  });
});

describe("parseInvite", () => {
  const secret = generateRoomSecret();

  it("round trips both roles", () => {
    for (const role of ["write", "read"] as const) {
      expect(parseInvite(buildInviteUrl(BASE, SLUG, secret, role))).toEqual({
        slug: SLUG,
        secret,
        role,
        locked: false,
      });
    }
  });

  it("reads the fragment in either order and alongside a share payload", () => {
    const url = `${BASE}?room=${SLUG}#share=${SHARE}&r=read&k=${secret}`;
    expect(parseInvite(url)).toEqual({ slug: SLUG, secret, role: "read", locked: false });
  });

  it("marks a link with no key as locked rather than failing", () => {
    expect(parseInvite(`${BASE}?room=${SLUG}`)).toEqual({ slug: SLUG, secret: null, role: "write", locked: true });
    expect(parseInvite(`${BASE}?room=${SLUG}#k=truncated`)?.locked).toBe(true);
  });

  it("ignores a role it does not recognise instead of trusting it", () => {
    expect(parseInvite(`${BASE}?room=${SLUG}#k=${secret}&r=admin`)?.role).toBe("write");
  });

  it("returns null when the link names no room", () => {
    expect(parseInvite(BASE)).toBeNull();
    expect(parseInvite(`${BASE}#k=${secret}`)).toBeNull();
    expect(parseInvite(`${BASE}?room=NOT_A_SLUG#k=${secret}`)).toBeNull();
    expect(parseInvite("")).toBeNull();
  });

  it("works on a relative link, which is what history.replaceState leaves behind", () => {
    expect(parseInvite(`/app?room=${SLUG}#k=${secret}`)?.secret).toBe(secret);
  });
});

describe("the words the UI says", () => {
  it("promises exactly what the crypto delivers and no more", () => {
    expect(ENCRYPTED_BADGE).toBe("Encrypted. Only people with this link can read this room.");
    expect(LOCKED_ROOM_MESSAGE).toBe(
      "This room is encrypted. Ask the person who invited you for the full link.",
    );
    expect(lockBadgeLabel("adbd32c5")).toBe("#adbd32c5");
    // One sentence and one action on the locked screen: no troubleshooting, no jargon.
    expect(LOCKED_ROOM_ACTION.split(" ")).toHaveLength(5);
    expect(inviteToast("read")).toContain("will not let it write");
  });
});
