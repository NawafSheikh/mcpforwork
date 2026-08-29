/**
 * The two room tools, in the shape src/monitors/handlers.ts uses: (input, ws) => {next?, result}.
 * Neither changes the workspace, so neither returns `next`; the registry still audits both,
 * which is the point, because opening a room to other people is worth a line in the rail.
 *
 * The names are not in src/webmcp/schemas.ts yet: the orchestrator merges roomToolSchemas,
 * roomToolDescriptions and roomJsonSchemas in when it wires this module (INTEGRATION.md).
 */
import { z } from "zod";
import { LIMITS, type Workspace } from "../types";
import { presenceLabel } from "./presence";
import { getRoomRuntime, createRoom, inviteUrl, isJoinFailure } from "./runtime";
import { chooseTransport } from "./transport";
import type { RoomRuntime } from "./sync";

export interface RoomHandlerResult {
  readonly next?: Workspace;
  readonly result: string;
}

export type RoomHandler = (input: unknown, ws: Workspace) => RoomHandlerResult;

export const ROOM_TOOL_NAMES = ["get_room", "create_room"] as const;
export type RoomToolName = (typeof ROOM_TOOL_NAMES)[number];

const callerSchema = z.string().min(1).max(LIMITS.maxCallerChars).optional();

export const roomToolSchemas = {
  get_room: z.object({ caller: callerSchema }),
  create_room: z.object({ caller: callerSchema }),
} as const;

export const roomJsonSchemas: Readonly<Record<RoomToolName, Record<string, unknown>>> = {
  get_room: { type: "object", properties: {}, additionalProperties: false },
  create_room: { type: "object", properties: {}, additionalProperties: false },
};

export const roomToolDescriptions: Readonly<Record<RoomToolName, string>> = {
  get_room:
    "Check whether this board is a shared room and who else is on it: the room id, the join link, how many browsers are connected and how many of them have an agent attached. Call it before create_room so you join the room that is already open instead of splitting the group into two.",
  create_room:
    "Open a shared room for this board and return the link to send to a colleague. Everyone who opens the link sees the same board, and every change either side makes shows up on the other within about a second. The room is encrypted end to end and the key is in the link after the #, so send the link whole and never trim it. Anyone holding it can join and edit.",
};

const NOT_IN_ROOM =
  "Not in a room. This board is local to this browser. Call create_room to open one and get a link to share.";

function describe(runtime: RoomRuntime): string {
  const state = runtime.peers();
  return JSON.stringify({
    room: runtime.slug,
    url: inviteUrl(runtime.slug),
    encrypted: true,
    relay: runtime.kind,
    status: runtime.status(),
    people: state.people,
    agents: state.agents,
    here: presenceLabel(state),
    peers: state.peers.map((peer) => ({ label: peer.label, agent: peer.agent, you: peer.self })),
  });
}

export const get_room: RoomHandler = () => {
  const runtime = getRoomRuntime();
  return { result: runtime === null ? NOT_IN_ROOM : describe(runtime) };
};

function failureText(reason: string): string {
  if (reason === "unconfigured") {
    return "Rooms are not switched on in this build, so the board stays local to this browser.";
  }
  return `Refused: this browser has no way to reach other people (${chooseTransport().note})`;
}

export const create_room: RoomHandler = () => {
  const existing = getRoomRuntime();
  if (existing !== null) {
    return {
      result:
        `This board is already room ${existing.slug}. Share this link: ${inviteUrl(existing.slug)} ` +
        `Right now: ${presenceLabel(existing.peers())}. The link carries the room key, so send it whole.`,
    };
  }
  const opened = createRoom();
  if (isJoinFailure(opened)) return { result: failureText(opened) };
  return {
    result:
      `Room ${opened.slug} is open and this board is now the shared board. ` +
      `Send this link whole: ${inviteUrl(opened.slug)} ` +
      "Everyone who opens it sees the same board and every change reaches the others in about a second. " +
      "The room is encrypted and the key is the part of the link after the #, so a trimmed link cannot open it. " +
      "Anyone with the whole link can join and edit, and the relay never keeps your board.",
  };
};

/** Merge into the handler map passed to createWebmcp once the names are in schemas.ts. */
export const roomHandlers: Readonly<Record<RoomToolName, RoomHandler>> = {
  get_room,
  create_room,
};

/** get_room reads, create_room opens a door: only the first is read-only. */
export const ROOM_READ_ONLY_TOOLS: readonly RoomToolName[] = ["get_room"];
/** Peer labels are typed by strangers, so anything echoing them is untrusted content. */
export const ROOM_UNTRUSTED_CONTENT_TOOLS: readonly RoomToolName[] = ["get_room"];
