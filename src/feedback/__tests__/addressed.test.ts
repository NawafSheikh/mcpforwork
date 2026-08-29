/**
 * Notes addressed to somebody rather than to an object on the board: agent to agent,
 * agent to person, person to agent and person to person, all in the one feedback record.
 */
import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "../../store/createStore";
import type { Feedback, FeedbackTarget, Workspace } from "../../types";
import {
  ANY_ONE,
  ROOM_TARGET,
  addFeedback,
  addressedFeedback,
  addressedTo,
  agentAddressedCount,
  describeTarget,
  isAgentAddressed,
  isFor,
  openFeedback,
  openFeedbackFor,
} from "../store";

const dashboard: FeedbackTarget = { kind: "dashboard", id: "Invoices" };
const toMaria: FeedbackTarget = { kind: "agent", id: "Maria's ChatGPT" };
const toAnyAgent: FeedbackTarget = { kind: "agent", id: ANY_ONE };
const toNawaf: FeedbackTarget = { kind: "person", id: "Nawaf" };

const base = (): Workspace => emptyWorkspace("local", "2026-08-29T09:00:00.000Z");

const find = (ws: Workspace, text: string): Feedback => {
  const item = Object.values(ws.feedback).find((entry) => entry.text === text);
  expect(item).toBeDefined();
  return item as Feedback;
};

describe("addressed targets", () => {
  it("keeps every new kind on the note and describes it in plain language", () => {
    const ws = addFeedback(base(), {
      target: toMaria,
      text: "Rebuild the Support dashboard",
      author: "agent",
      from: "Nawaf's ChatGPT",
    });
    const item = find(ws, "Rebuild the Support dashboard");

    expect(item.target).toEqual(toMaria);
    expect(item.author).toBe("agent");
    expect(item.from).toBe("Nawaf's ChatGPT");
    expect(describeTarget(toMaria)).toBe("agent Maria's ChatGPT");
    expect(describeTarget(toAnyAgent)).toBe("any agent in this room");
    expect(describeTarget(toNawaf)).toBe("person Nawaf");
    expect(describeTarget(ROOM_TARGET)).toBe("this room");
    expect(describeTarget(dashboard)).toBe("dashboard Invoices");
  });

  it("counts only the notes an agent is meant to pick up", () => {
    let ws = addFeedback(base(), { target: dashboard, text: "y axis", author: "human" });
    ws = addFeedback(ws, { target: toMaria, text: "for Maria", author: "agent", from: "A" });
    ws = addFeedback(ws, { target: ROOM_TARGET, text: "for the room", author: "human", from: "B" });
    ws = addFeedback(ws, { target: toNawaf, text: "for Nawaf", author: "agent", from: "A" });

    expect(openFeedback(ws)).toHaveLength(4);
    expect(agentAddressedCount(ws)).toBe(2);
    expect(isAgentAddressed(find(ws, "for Maria"))).toBe(true);
    expect(isAgentAddressed(find(ws, "for Nawaf"))).toBe(false);
    expect(addressedTo(find(ws, "for the room"))).toBe(ANY_ONE);
    expect(addressedTo(find(ws, "y axis"))).toBeNull();
  });

  it("matches a caller by name, case insensitively, and always matches a star", () => {
    let ws = addFeedback(base(), { target: toMaria, text: "named", author: "agent", from: "A" });
    ws = addFeedback(ws, { target: toAnyAgent, text: "anyone", author: "human", from: "B" });

    expect(isFor(find(ws, "named"), "maria's chatgpt")).toBe(true);
    expect(isFor(find(ws, "named"), "Somebody else")).toBe(false);
    expect(isFor(find(ws, "anyone"), "Somebody else")).toBe(true);
  });

  it("puts the notes a caller was asked to do first, and leaves others alone", () => {
    let ws = addFeedback(base(), { target: dashboard, text: "oldest", author: "human" });
    ws = addFeedback(ws, { target: toMaria, text: "yours", author: "agent", from: "A" });
    ws = addFeedback(ws, { target: dashboard, text: "newest", author: "human" });

    const mine = openFeedbackFor(ws, "Maria's ChatGPT");
    expect(mine[0]?.text).toBe("yours");
    expect(mine).toHaveLength(3);

    const theirs = openFeedbackFor(ws, "Somebody else");
    expect(theirs[0]?.text).toBe("newest");
    expect(openFeedbackFor(ws)).toEqual(openFeedback(ws));
  });

  it("collects every addressed note into the one room thread", () => {
    let ws = addFeedback(base(), { target: dashboard, text: "on the board", author: "human" });
    ws = addFeedback(ws, { target: ROOM_TARGET, text: "room ask", author: "human", from: "B" });
    ws = addFeedback(ws, { target: toNawaf, text: "person ask", author: "agent", from: "A" });

    const thread = addressedFeedback(ws);
    expect(thread.map((item) => item.text).sort()).toEqual(["person ask", "room ask"]);
  });

  it("caps a signature the same way it caps the text", () => {
    const ws = addFeedback(base(), {
      target: toMaria,
      text: "long signature",
      author: "agent",
      from: "n".repeat(120),
    });
    expect(find(ws, "long signature").from?.length).toBe(40);
  });
});
