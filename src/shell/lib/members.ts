/**
 * Who is here, for the left rail: people with what they are looking at and what they
 * hold, agents with their caller name, their person when the room makes that knowable,
 * what they are working on and when they last called.
 *
 * Pure on purpose, so the rail can be tested without a relay. Nothing here is an
 * identity claim: every name is self-reported, exactly like a caller label.
 */
import { describeClaimTarget } from "../../turns";
import type { PresenceState } from "../../rooms";
import type { Claim, Workspace } from "../../types";
import { callerName } from "./format";

export interface PersonRow {
  readonly id: string;
  readonly name: string;
  readonly self: boolean;
  /** What they are looking at. Only this browser can say for itself. */
  readonly viewing: string;
  /** Objects with their name on them right now. */
  readonly holding: readonly string[];
  /** True when that browser has site tools registered, so an agent can act there. */
  readonly hasAgent: boolean;
}

export interface AgentRow {
  readonly caller: string;
  /** The person it calls from, when exactly one browser here can host an agent. */
  readonly person?: string;
  readonly workingOn?: string;
  readonly lastCallAt?: string;
}

export interface MemberList {
  readonly people: readonly PersonRow[];
  readonly agents: readonly AgentRow[];
}

export interface MemberInput {
  readonly presence: PresenceState;
  readonly workspace: Workspace;
  readonly myName: string;
  /** The place this browser is on, in words. */
  readonly viewing: string;
  readonly agentHere: boolean;
}

const ELSEWHERE = "in this room";

function claimsOf(workspace: Workspace, kind: Claim["holderKind"], holder: string): readonly string[] {
  return Object.values(workspace.claims ?? {})
    .filter((claim) => claim.holderKind === kind)
    .filter((claim) => claim.holder.trim().toLowerCase() === holder.trim().toLowerCase())
    .map((claim) => describeClaimTarget(claim.target));
}

function selfRow(input: MemberInput, hasAgent: boolean, id: string): PersonRow {
  return {
    id,
    name: input.myName,
    self: true,
    viewing: input.viewing,
    holding: claimsOf(input.workspace, "person", input.myName),
    hasAgent,
  };
}

function people(input: MemberInput): readonly PersonRow[] {
  const { presence } = input;
  if (presence.slug === null) return [selfRow(input, input.agentHere, "self")];
  return presence.peers.map((peer) =>
    peer.self
      ? selfRow(input, peer.agent || input.agentHere, peer.clientId)
      : {
          id: peer.clientId,
          name: peer.label,
          self: false,
          viewing: ELSEWHERE,
          holding: claimsOf(input.workspace, "person", peer.label),
          hasAgent: peer.agent,
        },
  );
}

/**
 * Which person an agent belongs to. Tool calls carry a caller name, never a browser, so
 * this is only answerable when one browser in the room is the only one that can host an
 * agent. Anywhere else the card says the caller and leaves the person out.
 */
export function agentPerson(input: MemberInput): string | undefined {
  const { presence } = input;
  if (presence.slug === null) return input.agentHere ? input.myName : undefined;
  if (presence.agents !== 1) return undefined;
  const only = presence.peers.find((peer) => peer.agent);
  return only?.label;
}

function agentNames(workspace: Workspace): readonly string[] {
  const fromAudit = workspace.audit
    .filter((event) => event.actor === "agent")
    .map((event) => callerName(event));
  const fromClaims = Object.values(workspace.claims ?? {})
    .filter((claim) => claim.holderKind === "agent")
    .map((claim) => claim.holder);
  return [...new Set([...fromAudit, ...fromClaims])];
}

function lastCallAt(workspace: Workspace, caller: string): string | undefined {
  for (let i = workspace.audit.length - 1; i >= 0; i -= 1) {
    const event = workspace.audit[i];
    if (event !== undefined && event.actor === "agent" && callerName(event) === caller) {
      return event.at;
    }
  }
  return undefined;
}

function agents(input: MemberInput): readonly AgentRow[] {
  const person = agentPerson(input);
  return agentNames(input.workspace).map((caller) => {
    const working = claimsOf(input.workspace, "agent", caller);
    const at = lastCallAt(input.workspace, caller);
    return {
      caller,
      ...(person === undefined ? {} : { person }),
      ...(working[0] === undefined ? {} : { workingOn: working[0] }),
      ...(at === undefined ? {} : { lastCallAt: at }),
    };
  });
}

/** People first, then agents, each in the order the room reports them. */
export function buildMembers(input: MemberInput): MemberList {
  return { people: people(input), agents: agents(input) };
}
