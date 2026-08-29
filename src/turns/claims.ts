/**
 * Claims: who is working on what (docs/TURNS.md).
 *
 * A claim is taken automatically by whoever writes, held for LIMITS.claimMinutes of quiet,
 * refreshed by the holder's next write and released by the write that finishes the work.
 * Nobody has to ask for one and nobody is ever blocked by somebody else's: a claim is the
 * badge on the card and the line in presence, so people can see what is being worked on.
 *
 * Everything here is pure: a Workspace goes in and a new Workspace comes out, and an
 * expired claim is treated as if it were never there. The holder is self-reported, exactly
 * like a caller name or a display name: it labels a turn, it never authorises anything.
 */
import { LIMITS, type Claim, type ClaimTarget, type ClaimTargetKind, type Workspace } from "../types";

export const CLAIM_KINDS: readonly ClaimTargetKind[] = ["dashboard", "overview", "monitor", "note"];

/** An agent that does not name itself is still somebody, so its turn says ChatGPT. */
export const AGENT_FALLBACK = "ChatGPT";

const MINUTE_MS = 60_000;
const CLAIM_MS = LIMITS.claimMinutes * MINUTE_MS;
const MAX_LINE_CLAIMS = 3;

/** The record key for one object: "dashboard:Invoices", "overview:overview". */
export function claimKey(target: ClaimTarget): string {
  return `${target.kind}:${target.id}`;
}

/** "dashboard Invoices", "the overview", "monitor mon_1", "note fb_1". */
export function describeClaimTarget(target: ClaimTarget): string {
  return target.kind === "overview" ? "the overview" : `${target.kind} ${target.id}`;
}

/** The clock a person reads on a card: "23:40", in UTC so every browser agrees. */
export function clockTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso.slice(11, 16);
  return new Date(ms).toISOString().slice(11, 16);
}

/** "4 min", or "just now" for the first minute. Coarse on purpose. */
export function claimAge(claim: Claim, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - Date.parse(claim.since)) / MINUTE_MS);
  return Number.isFinite(minutes) && minutes >= 1 ? `${minutes} min` : "just now";
}

export function isLive(claim: Claim, now: Date = new Date()): boolean {
  const expires = Date.parse(claim.expiresAt);
  return Number.isNaN(expires) ? false : expires > now.getTime();
}

/** Case and space insensitive: an agent that renames itself mid-task keeps its turn. */
export function isHolder(claim: Claim, who: string | undefined): boolean {
  const name = who?.trim().toLowerCase();
  return name !== undefined && name.length > 0 && claim.holder.trim().toLowerCase() === name;
}

/** The claim on one object, or null when there is none or it has expired. */
export function claimOn(ws: Workspace, target: ClaimTarget, now: Date = new Date()): Claim | null {
  const claim = ws.claims?.[claimKey(target)];
  return claim !== undefined && isLive(claim, now) ? claim : null;
}

/** Every live claim, oldest turn first, so the board reads like a queue. */
export function liveClaims(ws: Workspace, now: Date = new Date()): readonly Claim[] {
  return Object.values(ws.claims ?? {})
    .filter((claim) => isLive(claim, now))
    .sort((a, b) => a.since.localeCompare(b.since));
}

function withClaims(ws: Workspace, claims: Readonly<Record<string, Claim>>): Workspace {
  return { ...ws, claims };
}

/** Drop everything that has expired. Returns the same object when nothing changed. */
export function pruneClaims(ws: Workspace, now: Date = new Date()): Workspace {
  const entries = Object.entries(ws.claims ?? {});
  const live = entries.filter(([, claim]) => isLive(claim, now));
  if (live.length === entries.length) return ws;
  return withClaims(ws, Object.fromEntries(live));
}

/** Room for one more turn: the oldest is dropped rather than refusing a new claim. */
function capClaims(claims: Record<string, Claim>): Record<string, Claim> {
  const entries = Object.entries(claims);
  if (entries.length <= LIMITS.maxClaims) return claims;
  const ordered = [...entries].sort(([, a], [, b]) => a.since.localeCompare(b.since));
  return Object.fromEntries(ordered.slice(entries.length - LIMITS.maxClaims));
}

export interface HoldInput {
  readonly target: ClaimTarget;
  readonly holder: string;
  readonly holderKind: Claim["holderKind"];
}

/** Take the turn. The caller checks first whether somebody else already holds it. */
export function holdClaim(ws: Workspace, input: HoldInput, now: Date = new Date()): Workspace {
  const at = now.toISOString();
  const existing = claimOn(ws, input.target, now);
  const claim: Claim = {
    target: input.target,
    holder: input.holder,
    holderKind: input.holderKind,
    since: existing !== null && isHolder(existing, input.holder) ? existing.since : at,
    expiresAt: new Date(now.getTime() + CLAIM_MS).toISOString(),
  };
  const pruned = pruneClaims(ws, now);
  return withClaims(pruned, capClaims({ ...pruned.claims, [claimKey(input.target)]: claim }));
}

/** Push the expiry out because the holder just wrote. A stranger's write changes nothing. */
export function refreshClaim(
  ws: Workspace,
  target: ClaimTarget,
  holder: string | undefined,
  now: Date = new Date(),
): Workspace {
  const claim = claimOn(ws, target, now);
  if (claim === null || !isHolder(claim, holder)) return pruneClaims(ws, now);
  return holdClaim(ws, { target, holder: claim.holder, holderKind: claim.holderKind }, now);
}

function dropKey(claims: Readonly<Record<string, Claim>>, key: string): Readonly<Record<string, Claim>> {
  if (!Object.prototype.hasOwnProperty.call(claims, key)) return claims;
  return Object.fromEntries(Object.entries(claims).filter(([existing]) => existing !== key));
}

/** Give the turn back, whoever held it. Used by release and by the finishing write. */
export function dropClaim(ws: Workspace, target: ClaimTarget, now: Date = new Date()): Workspace {
  const pruned = pruneClaims(ws, now);
  const claims = dropKey(pruned.claims ?? {}, claimKey(target));
  return claims === pruned.claims ? pruned : withClaims(pruned, claims);
}

/** The line an agent reads when somebody else is mid-edit. Information, not a refusal. */
export function workingOnText(claim: Claim, now: Date = new Date()): string {
  return `${claim.holder} is working on ${describeClaimTarget(claim.target)} (${claimAge(claim, now)}).`;
}

/** "Maria's agent on Invoices, Nawaf on Guardrails", for the presence chip. */
export function claimsLine(ws: Workspace, now: Date = new Date()): string {
  const claims = liveClaims(ws, now);
  const shown = claims
    .slice(0, MAX_LINE_CLAIMS)
    .map((claim) => `${claim.holder} on ${claim.target.kind === "overview" ? "the overview" : claim.target.id}`);
  const more = claims.length - shown.length;
  return more > 0 ? `${shown.join(", ")} +${more}` : shown.join(", ");
}
