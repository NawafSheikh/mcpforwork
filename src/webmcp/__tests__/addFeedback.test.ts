/**
 * add_feedback through the registry: one person's agent hands work to another's, both
 * humans watch it land, and the agent that owns it sees it first in list_feedback.
 */
import { describe, expect, it } from "vitest";
import { createWorkspaceStore } from "../../store/createStore";
import { addFeedback } from "../../feedback/store";
import { workspaceHandlers } from "../handlers";
import { createToolRegistry } from "../registry";
import type { Feedback, Workspace } from "../../types";

const setup = () => {
  const store = createWorkspaceStore({ mode: "demo", persist: false });
  const registry = createToolRegistry({ store, handlers: workspaceHandlers });
  return { store, registry };
};

interface Row {
  readonly id: string;
  readonly for: { readonly kind: string; readonly id: string };
  readonly from?: string;
  readonly authorKind: string;
  readonly text: string;
  readonly addressedTo?: string;
}

const rows = (json: string): readonly Row[] => (JSON.parse(json) as { feedback: Row[] }).feedback;

const only = (ws: Workspace): Feedback => {
  const items = Object.values(ws.feedback);
  expect(items).toHaveLength(1);
  return items[0] as Feedback;
};

describe("add_feedback", () => {
  it("writes an agent note signed with the caller", async () => {
    const { registry, store } = setup();

    const result = await registry.call("add_feedback", {
      target: { kind: "agent", id: "Maria's ChatGPT" },
      text: "Please rebuild the Support dashboard from the new export",
      caller: "Nawaf's ChatGPT",
    });

    expect(result).toBe(
      "Note left for agent Maria's ChatGPT. Agents in this room see it through list_feedback.",
    );
    const item = only(store.get());
    expect(item.author).toBe("agent");
    expect(item.from).toBe("Nawaf's ChatGPT");
    expect(item.target).toEqual({ kind: "agent", id: "Maria's ChatGPT" });
  });

  it("signs an unnamed agent ChatGPT and keeps caller out of the note target", async () => {
    const { registry, store } = setup();
    await registry.call("add_feedback", { target: { kind: "agent", id: "*" }, text: "Anyone free" });

    expect(only(store.get()).from).toBe("ChatGPT");
    expect(await registry.call("list_feedback", {})).toContain('"addressedTo":"*"');
  });

  it("accepts every target kind, board objects and people alike", async () => {
    const { registry, store } = setup();
    const kinds = ["dashboard", "overview", "draft", "monitor", "agent", "room", "person"] as const;
    for (const kind of kinds) {
      await registry.call("add_feedback", { target: { kind, id: "x" }, text: `note for ${kind}` });
    }

    const stored = Object.values(store.get().feedback).map((item) => item.target.kind);
    expect([...stored].sort()).toEqual([...kinds].sort());
  });

  it("leaves a note a named person can read on the page", async () => {
    const { registry, store } = setup();
    const said = await registry.call("add_feedback", {
      target: { kind: "person", id: "Nawaf" },
      text: "The EUR 7,200 invoice needs you",
      caller: "Maria's ChatGPT",
    });

    expect(said).toContain("Note left for person Nawaf");
    expect(only(store.get()).text).toBe("The EUR 7,200 invoice needs you");
  });

  it("refuses an empty note and an over-long one without touching the board", async () => {
    const { registry, store } = setup();
    const empty = await registry.call("add_feedback", {
      target: { kind: "room", id: "room" },
      text: "",
    });
    const huge = await registry.call("add_feedback", {
      target: { kind: "room", id: "room" },
      text: "x".repeat(900),
    });

    expect(empty).toContain("Invalid input for add_feedback");
    expect(huge).toContain("Invalid input for add_feedback");
    expect(store.get().feedback).toEqual({});
  });

  it("is a write tool, so the board changes and the rail records the caller", async () => {
    const { registry, store } = setup();
    await registry.call("add_feedback", {
      target: { kind: "room", id: "room" },
      text: "Who is covering Friday",
      caller: "Maria's ChatGPT",
    });

    const events = store.get().audit;
    expect(events.some((event) => event.tool === "add_feedback" && event.caller === "Maria's ChatGPT")).toBe(true);
    expect(events.some((event) => event.tool === "feedback" && event.actor === "agent")).toBe(true);
  });
});

describe("list_feedback for an addressed caller", () => {
  const seed = (store: ReturnType<typeof setup>["store"]) =>
    store.update((ws) => {
      const one = addFeedback(ws, {
        target: { kind: "dashboard", id: "Invoices" },
        text: "oldest, on an object",
        author: "human",
        from: "Maria",
      });
      const two = addFeedback(one, {
        target: { kind: "agent", id: "Maria's ChatGPT" },
        text: "yours to pick up",
        author: "agent",
        from: "Nawaf's ChatGPT",
      });
      return addFeedback(two, {
        target: { kind: "dashboard", id: "Invoices" },
        text: "newest, on an object",
        author: "human",
        from: "Maria",
      });
    });

  it("puts the notes addressed to the caller first", async () => {
    const { registry, store } = setup();
    await seed(store);

    const mine = rows(await registry.call("list_feedback", { caller: "Maria's ChatGPT" }));
    expect(mine[0]?.text).toBe("yours to pick up");
    expect(mine[0]?.addressedTo).toBe("Maria's ChatGPT");
    expect(mine).toHaveLength(3);
  });

  it("stays newest first for a caller nobody addressed", async () => {
    const { registry, store } = setup();
    await seed(store);

    const theirs = rows(await registry.call("list_feedback", { caller: "Somebody else" }));
    expect(theirs[0]?.text).toBe("newest, on an object");
  });

  it("carries for, from and authorKind on every row", async () => {
    const { registry, store } = setup();
    await seed(store);

    const all = rows(await registry.call("list_feedback", {}));
    const handed = all.find((row) => row.text === "yours to pick up");
    const human = all.find((row) => row.text === "newest, on an object");

    expect(handed).toMatchObject({
      for: { kind: "agent", id: "Maria's ChatGPT" },
      from: "Nawaf's ChatGPT",
      authorKind: "agent",
      addressedTo: "Maria's ChatGPT",
    });
    expect(human).toMatchObject({ authorKind: "person", from: "Maria" });
    expect(human?.addressedTo).toBeUndefined();
  });

  it("keeps a long thread inside the output budget by dropping rows, not halving one", async () => {
    const { registry, store } = setup();
    for (let i = 0; i < 40; i += 1) {
      await store.update((ws) =>
        addFeedback(ws, {
          target: { kind: "agent", id: "Maria's ChatGPT" },
          text: `request number ${i} with enough words in it to take real space`,
          author: "agent",
          from: "Nawaf's ChatGPT",
        }),
      );
    }

    const said = await registry.call("list_feedback", { caller: "Maria's ChatGPT" });
    const parsed = JSON.parse(said) as { shown: number; total: number };
    expect(said.length).toBeLessThanOrEqual(1500);
    expect(parsed.total).toBe(40);
    expect(parsed.shown).toBeGreaterThan(0);
    expect(parsed.shown).toBeLessThan(40);
  });
});

describe("resolve_feedback on a handed-over note", () => {
  it("names who asked, on the reply and in the trail", async () => {
    const { registry, store } = setup();
    await registry.call("add_feedback", {
      target: { kind: "agent", id: "Maria's ChatGPT" },
      text: "Rebuild Support",
      caller: "Nawaf's ChatGPT",
    });
    const id = Object.keys(store.get().feedback)[0] as string;

    const said = await registry.call("resolve_feedback", {
      feedbackId: id,
      resolution: "Rebuilt it from the August export",
      caller: "Maria's ChatGPT",
    });

    expect(said).toContain("from Nawaf's ChatGPT");
    const trail = store.get().audit.find((event) => event.result?.startsWith("Resolved note on"));
    expect(trail?.result).toContain("from Nawaf's ChatGPT");
  });
});

describe("get_workspace suffix", () => {
  it("counts the notes waiting on an agent", async () => {
    const { registry, store } = setup();
    await registry.call("add_feedback", { target: { kind: "agent", id: "*" }, text: "anyone" });
    await registry.call("add_feedback", { target: { kind: "room", id: "room" }, text: "everyone" });
    await store.update((ws) =>
      addFeedback(ws, { target: { kind: "dashboard", id: "Invoices" }, text: "y axis", author: "human" }),
    );

    const said = await registry.call("get_workspace", {});
    expect(
      said.endsWith("Open feedback: 3 (2 addressed to agents). Call list_feedback before editing."),
    ).toBe(true);
  });

  it("says nothing about agents when every note is on an object", async () => {
    const { registry, store } = setup();
    await store.update((ws) =>
      addFeedback(ws, { target: { kind: "dashboard", id: "Invoices" }, text: "y axis", author: "human" }),
    );

    const said = await registry.call("get_workspace", {});
    expect(said.endsWith("Open feedback: 1. Call list_feedback before editing.")).toBe(true);
  });
});
