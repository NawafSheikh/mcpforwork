/**
 * The pure half of the new shell: what the rails, the feed and the next step card decide
 * before anything renders. No DOM here on purpose, so the rules are readable as rules.
 */
import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "../../store";
import { appendAudit, makeAuditEvent } from "../../store/audit";
import { holdClaim } from "../../turns";
import type { PresenceState, RoomPeer } from "../../rooms";
import type { AuditEvent, Category, Workspace } from "../../types";
import { EVERYONE, groupFeed, peerOf } from "../lib/feed";
import { buildMembers } from "../lib/members";
import { controlRows } from "../lib/controls";
import { nextStep } from "../lib/nextStep";
import { placeForEvent, placeRows, samePlace } from "../lib/places";
import { pulseFor } from "../lib/pulse";
import { boardIsEmpty, roomTitle } from "../lib/room";

const NOW = new Date("2026-08-29T10:00:00.000Z");
const PROMPTS = { starter: "STARTER", approveAll: "APPROVE ALL", nextProject: "NEXT PROJECT" };

function category(name: string, rows: number): Category {
  return {
    name,
    createdAt: NOW.toISOString(),
    summary: { rowCount: rows, updatedAt: NOW.toISOString() },
  };
}

function board(): Workspace {
  const base = emptyWorkspace("local");
  return {
    ...base,
    categories: { Invoices: category("Invoices", 30), Tickets: category("Tickets", 10) },
  };
}

function event(input: Partial<AuditEvent> & { readonly id: string }): AuditEvent {
  return {
    at: NOW.toISOString(),
    actor: "agent",
    ok: true,
    ...input,
  } as AuditEvent;
}

function peer(label: string, self: boolean, agent: boolean): RoomPeer {
  return {
    clientId: `c_${label}`,
    label,
    agent,
    updatedAt: NOW.toISOString(),
    entities: 3,
    lastSeenAt: NOW.getTime(),
    self,
  };
}

function presence(peers: readonly RoomPeer[]): PresenceState {
  return {
    slug: "abc123def",
    status: "open",
    transport: "broadcast",
    peers,
    people: peers.length,
    agents: peers.filter((entry) => entry.agent).length,
  };
}

describe("places", () => {
  it("lists the overview, the categories and every page, with counts and share", () => {
    const rows = placeRows(board(), ["Tickets"], { openRequests: 2, heldDrafts: 1, datasets: 0 });
    const ids = rows.map((row) => row.id);

    expect(ids[0]).toBe("overview");
    // Pinned first, whatever the alphabet says.
    expect(ids[1]).toBe("category:Tickets");
    expect(ids).toContain("category:Invoices");
    expect(ids.slice(-5)).toEqual(["monitors", "datasets", "requests", "activity", "about"]);

    const invoices = rows.find((row) => row.id === "category:Invoices");
    expect(invoices?.meta).toBe("30 records · 75% of board");
    expect(rows.find((row) => row.id === "requests")?.badge).toBe(2);
    expect(rows.find((row) => row.id === "monitors")?.badge).toBe(1);
  });

  it("jumps from an event to the object it changed", () => {
    const ws = board();
    const toCategory = placeForEvent(
      event({ id: "e1", tool: "upsert_dashboard", argsPreview: '{"category":"Invoices"}' }),
      ws,
    );
    expect(toCategory && samePlace(toCategory, { kind: "category", name: "Invoices" })).toBe(true);
    expect(placeForEvent(event({ id: "e2", tool: "compose_overview" }), ws)?.kind).toBe("overview");
    expect(placeForEvent(event({ id: "e3", tool: "register_monitor" }), ws)?.kind).toBe("monitors");
    expect(placeForEvent(event({ id: "e4", tool: "feedback" }), ws)?.kind).toBe("requests");
    expect(placeForEvent(event({ id: "e5", tool: "who_knows" }), ws)).toBeNull();
  });
});

describe("members", () => {
  const ws = holdClaim(
    holdClaim(board(), { target: { kind: "dashboard", id: "Invoices" }, holder: "Ana", holderKind: "agent" }, NOW),
    { target: { kind: "overview", id: "overview" }, holder: "Maria", holderKind: "person" },
    NOW,
  );

  it("says what each person is looking at and what they hold", () => {
    const members = buildMembers({
      presence: presence([peer("Maria", true, true), peer("Nawaf", false, false)]),
      workspace: ws,
      myName: "Maria",
      viewing: "Invoices",
      agentHere: true,
    });

    expect(members.people.map((person) => person.name)).toEqual(["Maria", "Nawaf"]);
    expect(members.people[0]?.viewing).toBe("Invoices");
    expect(members.people[0]?.holding).toEqual(["the overview"]);
    expect(members.people[1]?.holding).toEqual([]);
  });

  it("names an agent, what it is working on, and its person when that is knowable", () => {
    const withCall = appendAudit(
      ws,
      makeAuditEvent({ actor: "agent", caller: "Ana", tool: "upsert_dashboard", args: {}, ok: true }),
    );
    const members = buildMembers({
      presence: presence([peer("Maria", true, true), peer("Nawaf", false, false)]),
      workspace: withCall,
      myName: "Maria",
      viewing: "Overview",
      agentHere: true,
    });

    const ana = members.agents.find((agent) => agent.caller === "Ana");
    expect(ana?.workingOn).toBe("dashboard Invoices");
    expect(ana?.person).toBe("Maria");
    expect(ana?.lastCallAt).toBeDefined();
  });

  it("leaves the person out when two browsers could be hosting the agent", () => {
    const members = buildMembers({
      presence: presence([peer("Maria", true, true), peer("Nawaf", false, true)]),
      workspace: ws,
      myName: "Maria",
      viewing: "Overview",
      agentHere: true,
    });
    expect(members.agents[0]?.person).toBeUndefined();
  });
});

describe("the live feed", () => {
  it("groups a burst from one caller into one block, newest first", () => {
    const events: readonly AuditEvent[] = [
      event({ id: "e1", caller: "Ana", tool: "create_category" }),
      event({ id: "e2", caller: "Ana", tool: "upsert_dashboard" }),
      event({ id: "e3", caller: "Ben", tool: "compose_overview" }),
    ];
    const groups = groupFeed(events);

    expect(groups.map((group) => group.peer)).toEqual(["Ben", "Ana"]);
    expect(groups[1]?.events.map((entry) => entry.id)).toEqual(["e2", "e1"]);
  });

  it("filters to one person or agent", () => {
    const events: readonly AuditEvent[] = [
      event({ id: "e1", caller: "Ana" }),
      event({ id: "e2", actor: "human" }),
    ];
    expect(groupFeed(events, "Ana")).toHaveLength(1);
    expect(groupFeed(events, EVERYONE)).toHaveLength(2);
    expect(peerOf(event({ id: "e3", actor: "human" }))).toBe("A person");
    expect(peerOf(event({ id: "e4", actor: "system" }))).toBe("System");
  });
});

describe("the pulse on a card", () => {
  it("names whoever changed the thing you are looking at, and forgets old news", () => {
    const ws = appendAudit(
      board(),
      makeAuditEvent({
        actor: "agent",
        caller: "Ana",
        tool: "upsert_dashboard",
        args: { category: "Invoices" },
        ok: true,
      }),
    );
    const place = { kind: "category", name: "Invoices" } as const;

    expect(pulseFor(ws, place)?.by).toBe("Ana");
    expect(pulseFor(ws, place, Date.now() + 600_000)).toBeNull();
    expect(pulseFor(ws, { kind: "monitors" })).toBeNull();
  });
});

describe("the next step card", () => {
  const base = {
    hasName: true,
    connected: true,
    emptyBoard: false,
    openRequests: 0,
    heldDrafts: 0,
    inRoom: false,
    people: 1,
  };

  it("starts an empty board with the starter prompt", () => {
    const card = nextStep({ ...base, emptyBoard: true }, PROMPTS);
    expect(card.id).toBe("starter");
    expect(card.prompt).toBe("STARTER");
  });

  it("sends the agent to list_feedback when something is open", () => {
    const card = nextStep({ ...base, openRequests: 2 }, PROMPTS);
    expect(card.id).toBe("requests");
    expect(card.title).toContain("2 open");
    expect(card.prompt).toContain("list_feedback");
  });

  it("offers the approve-all prompt when drafts are held", () => {
    const card = nextStep({ ...base, heldDrafts: 3 }, PROMPTS);
    expect(card.id).toBe("drafts");
    expect(card.prompt).toBe("APPROVE ALL");
  });

  it("asks for an invite in a room with nobody in it", () => {
    const card = nextStep({ ...base, inRoom: true, people: 1 }, PROMPTS);
    expect(card.id).toBe("invite");
    expect(card.prompt).toBeUndefined();
  });

  it("offers the next workspace when nothing is waiting", () => {
    const card = nextStep({ ...base, inRoom: true, people: 3 }, PROMPTS);
    expect(card.id).toBe("steady");
    expect(card.prompt).toBe("NEXT PROJECT");
  });

  it("puts the board before everything else", () => {
    expect(nextStep({ ...base, emptyBoard: true, openRequests: 4 }, PROMPTS).id).toBe("starter");
  });

  it("asks for a name before anything else, and offers a field not a prompt", () => {
    const card = nextStep({ ...base, hasName: false, emptyBoard: true, heldDrafts: 2 }, PROMPTS);
    expect(card.id).toBe("name");
    expect(card.prompt).toBeUndefined();
    expect(card.focus).toBeDefined();
  });

  it("sends a named visitor into ChatGPT desktop with the steps", () => {
    const card = nextStep({ ...base, connected: false, emptyBoard: true }, PROMPTS);
    expect(card.id).toBe("connect");
    expect(card.steps?.length).toBeGreaterThan(0);
  });
});

describe("what you control", () => {
  const input = {
    workspaces: 1,
    workspaceName: "My workspace",
    saved: "Saved just now",
    categories: 0,
    monitors: 0,
    toolsOn: 35,
    toolsTotal: 35,
    packsOn: 7,
    packsTotal: 7,
    room: null,
    people: 1,
    datasets: 0,
  };

  it("says empty when the board is empty, and never invents a number", () => {
    const rows = controlRows(input);
    expect(rows.map((row) => row.id)).toEqual([
      "workspaces",
      "board",
      "guardrails",
      "tools",
      "rooms",
      "data",
    ]);
    expect(rows[0]?.state).toBe("My workspace, saved just now");
    expect(rows[1]?.state).toBe("empty, your agent builds it");
    expect(rows[2]?.state).toBe("no monitors yet");
    expect(rows[3]?.state).toBe("35 tools in 7 packs, all on");
    expect(rows[4]?.state).toBe("only this browser");
    expect(rows[5]?.state).toBe("nothing dropped");
  });

  it("counts what is there once there is something there", () => {
    const rows = controlRows({
      ...input,
      workspaces: 3,
      workspaceName: "Invoices",
      saved: "Saved 4m ago",
      categories: 4,
      monitors: 1,
      toolsOn: 21,
      packsOn: 5,
      room: "Q3 close",
      people: 2,
      datasets: 3,
    });
    expect(rows[0]?.state).toBe("Invoices, 2 more here, saved 4m ago");
    expect(rows[1]?.state).toBe("4 categories");
    expect(rows[2]?.state).toBe("1 monitor");
    expect(rows[3]?.state).toBe("21 of 35 tools, 5 of 7 packs on");
    expect(rows[4]?.state).toBe("Q3 close, 2 members");
    expect(rows[5]?.state).toBe("3 datasets");
  });
});

describe("the room line", () => {
  it("is the local board until there is a room, then the slug until it is named", () => {
    const ws = board();
    expect(roomTitle(ws, null)).toBe("Local board");
    expect(roomTitle(ws, "abc123def")).toBe("Room abc123def");
    expect(roomTitle({ ...ws, name: "Q3 close" }, "abc123def")).toBe("Q3 close");
  });

  it("knows an empty board from a working one", () => {
    expect(boardIsEmpty(emptyWorkspace("local"))).toBe(true);
    expect(boardIsEmpty(board())).toBe(false);
  });
});
