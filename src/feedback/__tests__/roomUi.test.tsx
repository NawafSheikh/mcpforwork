/** Agent notes in the box, the room thread, and the name chip. */
import { beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkspaceStore } from "../../store/createStore";
import { ShellProvider } from "../../shell/context";
import { FeedbackBox } from "../ui/FeedbackBox";
import { RoomRequests } from "../ui/RoomRequests";
import { NameChip } from "../ui/NameChip";
import { authorLabel, targetLabel } from "../ui/notes";
import { ANY_ONE, ROOM_TARGET, addFeedback, resolveFeedback } from "../store";
import { NAME_KEY, resetNameCache } from "../identity";
import type { Feedback, FeedbackTarget, Workspace } from "../../types";

const dashboard: FeedbackTarget = { kind: "dashboard", id: "Invoices" };
const toMaria: FeedbackTarget = { kind: "agent", id: "Maria" };
const toNawaf: FeedbackTarget = { kind: "person", id: "Nawaf" };

const statusStore = {
  get: () => ({ available: false, registered: 0 }),
  subscribe: () => () => undefined,
};

function paint(node: JSX.Element, seed: (ws: Workspace) => Workspace = (ws) => ws): string {
  const store = createWorkspaceStore({ mode: "demo", persist: false });
  const initial = seed(store.get());
  const seeded = createWorkspaceStore({ mode: "demo", persist: false, initial });
  return renderToStaticMarkup(
    <ShellProvider store={seeded} statusStore={statusStore}>
      {node}
    </ShellProvider>,
  );
}

beforeEach(() => {
  globalThis.localStorage?.clear();
  resetNameCache();
});

describe("note chips", () => {
  const note = (patch: Partial<Feedback>): Feedback => ({
    id: "f1",
    target: dashboard,
    text: "t",
    author: "human",
    createdAt: "2026-08-29T09:00:00.000Z",
    ...patch,
  });

  it("names the author by kind and signature", () => {
    expect(authorLabel(note({ author: "agent", from: "Classify 1-25" }))).toBe("Agent · Classify 1-25");
    expect(authorLabel(note({ author: "agent" }))).toBe("Agent · ChatGPT");
    expect(authorLabel(note({ from: "Maria" }))).toBe("Person · Maria");
    expect(authorLabel(note({}))).toBe("You");
  });

  it("only shows a for chip on an addressed note", () => {
    expect(targetLabel(dashboard)).toBeNull();
    expect(targetLabel(toMaria)).toBe("for agent Maria");
    expect(targetLabel({ kind: "agent", id: ANY_ONE })).toBe("for any agent");
    expect(targetLabel(toNawaf)).toBe("for person Nawaf");
    expect(targetLabel({ kind: "person", id: ANY_ONE })).toBe("for everyone");
    expect(targetLabel(ROOM_TARGET)).toBe("for this room");
  });
});

describe("FeedbackBox with agent notes", () => {
  it("shows an agent note with its caller chip", () => {
    const html = paint(<FeedbackBox target={dashboard} />, (ws) =>
      addFeedback(ws, {
        target: dashboard,
        text: "Rebuilt the y axis",
        author: "agent",
        from: "Classify 1-25",
      }),
    );
    expect(html).toContain("Agent · Classify 1-25");
    expect(html).toContain("mfw-fb-author-agent");
    expect(html).not.toContain(String.raw`class="mfw-fb-for"`);
  });
});

describe("RoomRequests", () => {
  const seeded = (ws: Workspace): Workspace => {
    const one = addFeedback(ws, {
      target: toMaria,
      text: "Take the Support rebuild",
      author: "agent",
      from: "Nawaf's ChatGPT",
    });
    const two = addFeedback(one, {
      target: toNawaf,
      text: "The EUR 7,200 invoice needs you",
      author: "agent",
      from: "Maria's ChatGPT",
    });
    return addFeedback(two, {
      target: ROOM_TARGET,
      text: "Who is covering Friday",
      author: "human",
      from: "Maria",
    });
  };

  it("carries agent to agent, agent to person and person to room in one thread", () => {
    const html = paint(<RoomRequests />, seeded);

    expect(html).toContain("Room requests");
    expect(html).toContain("Ask the agents in this room");
    expect(html).toContain("Take the Support rebuild");
    expect(html).toContain("for agent Maria");
    expect(html).toContain("The EUR 7,200 invoice needs you");
    expect(html).toContain("for person Nawaf");
    expect(html).toContain("Person · Maria");
    expect(html).toContain("for this room");
    expect(html).toContain("3 open");
  });

  it("leaves the notes left on board objects to their own boxes", () => {
    const html = paint(<RoomRequests />, (ws) =>
      addFeedback(ws, { target: dashboard, text: "y axis is wrong", author: "human" }),
    );
    expect(html).not.toContain("y axis is wrong");
    expect(html).toContain("nothing open");
  });

  it("folds resolved requests away behind a count", () => {
    const html = paint(<RoomRequests />, (ws) => {
      const added = addFeedback(ws, {
        target: toMaria,
        text: "Take this",
        author: "agent",
        from: "A",
      });
      const id = Object.keys(added.feedback)[0] as string;
      return resolveFeedback(added, id, { by: "agent", resolution: "Done" }) ?? added;
    });
    expect(html).toContain("Done (1)");
    expect(html).toContain("nothing open");
  });
});

describe("NameChip", () => {
  it("shows the default name when this browser has never said one", () => {
    expect(paint(<NameChip />)).toContain("Someone");
  });

  it("shows the stored name and offers it for editing", () => {
    globalThis.localStorage.setItem(NAME_KEY, "Maria");
    const html = paint(<NameChip />);
    expect(html).toContain("Maria");
    expect(html).toContain("Your name on this board");
  });
});
