/**
 * Attaching sessions, and ruling on each one.
 *
 * The behaviour under test is a sequence, not four independent tools: a person attaches
 * what is running, and the agent then has to reach a verdict on every one of them. So most
 * of these run the sequence and check what the board looks like afterwards, rather than
 * calling a handler once and inspecting its return value.
 *
 * Two rules carry the design and each has a test that fails if it is quietly relaxed:
 * a one-off is a recorded verdict rather than an omission, and a session becoming a loop
 * goes through the same feed rules a hand-registered loop does, refusals included.
 */
import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "../../store";
import { listLoops, putLoop } from "../../loops/state";
import type { Loop, Workspace } from "../../types";
import { listOutside, listSessions, placedAs, unplaced } from "../state";
import { sessionHandlers } from "../tools";

const AT = "2026-08-31T09:00:00.000Z";

function board(): Workspace {
  return emptyWorkspace("local", AT);
}

const call = (
  tool: keyof typeof sessionHandlers,
  input: Record<string, unknown>,
  ws: Workspace,
): { ws: Workspace; result: string } => {
  const outcome = sessionHandlers[tool](input, ws);
  return { ws: outcome.next ?? ws, result: outcome.result };
};

const RUNNING = [
  { id: "claude-code-34652", kind: "claude-code", what: "claude --resume", where: "mcpforwork" },
  { id: "claude-code-36048", kind: "claude-code", what: "claude.exe --resume 1359", where: "spidey-bot" },
  { id: "chatgpt-desktop-3368", kind: "chatgpt-desktop", what: "ChatGPT.exe" },
];

function attached(): Workspace {
  return call("attach_sessions", { sessions: RUNNING, from: "Nawaf's Codex" }, board()).ws;
}

describe("attaching what is already running", () => {
  it("puts them on the board with no verdict yet", () => {
    const ws = attached();
    expect(listSessions(ws)).toHaveLength(3);
    expect(unplaced(ws)).toHaveLength(3);
    for (const session of listSessions(ws)) {
      expect(session.host).toBe("Nawaf's Codex");
      expect(session.placement).toBe("unplaced");
    }
  });

  it("says how many are waiting, so the next move is obvious", () => {
    const { result } = call("attach_sessions", { sessions: RUNNING, from: "Nawaf's Codex" }, board());
    expect(result).toContain("3 now waiting");
    expect(result).toContain("place_session");
  });

  it("asks for the sessions themselves rather than accepting an empty call", () => {
    const { ws, result } = call("attach_sessions", { sessions: [] }, board());
    expect(listSessions(ws)).toHaveLength(0);
    expect(result).toContain("list_sessions");
  });

  it("drops a row the bridge sent badly instead of taking the whole call down", () => {
    const { ws } = call(
      "attach_sessions",
      { sessions: [...RUNNING, { id: "", kind: "claude-code", what: "x" }, { id: "z", kind: "nope", what: "y" }] },
      board(),
    );
    expect(listSessions(ws)).toHaveLength(3);
  });

  it("keeps yesterday's verdict when the same session is attached again", () => {
    // Reopening a workspace should not throw away the reasoning already on it. A person
    // ticking the same session twice is not asking for it to be reconsidered.
    const once = attached();
    const ruled = call(
      "place_session",
      { session: "chatgpt-desktop-3368", as: "one-off", why: "it is where I am typing", from: "a" },
      once,
    ).ws;
    const twice = call("attach_sessions", { sessions: RUNNING, from: "Nawaf's Codex" }, ruled).ws;

    expect(placedAs(twice, "one-off").map((s) => s.id)).toEqual(["chatgpt-desktop-3368"]);
    expect(unplaced(twice)).toHaveLength(2);
  });
});

describe("ruling on each one", () => {
  it("turns a session into a loop on the board", () => {
    const ws = call(
      "place_session",
      {
        session: "claude-code-36048",
        as: "loop",
        why: "it runs the nightly build and other work waits on it",
        name: "spidey build",
        does: "build and test spidey-bot",
        layer: 0,
        every: "nightly",
        from: "Nawaf's Codex",
      },
      attached(),
    ).ws;

    const loop = listLoops(ws).find((item) => item.name === "spidey build");
    expect(loop?.layer).toBe(0);
    expect(loop?.every).toBe("nightly");
    expect(loop?.host).toBe("Nawaf's Codex");
    const session = listSessions(ws).find((item) => item.id === "claude-code-36048");
    expect(session?.placement).toBe("loop");
    expect(session?.loop).toBe(loop?.id);
    expect(session?.why).toContain("nightly build");
  });

  it("names the session and the reason back, so a person can argue with it", () => {
    const { result } = call(
      "place_session",
      { session: "claude-code-36048", as: "loop", why: "other work waits on it", name: "build", from: "a" },
      attached(),
    );
    expect(result).toContain("Claude Code");
    expect(result).toContain("other work waits on it");
  });

  it("records a one-off as a verdict rather than dropping it", () => {
    // The rule: "looked at and ruled out" must not render the same as "never looked at".
    const ws = call(
      "place_session",
      { session: "chatgpt-desktop-3368", as: "one-off", why: "it is the chat I am in, not a job", from: "a" },
      attached(),
    ).ws;

    expect(listSessions(ws)).toHaveLength(3);
    expect(placedAs(ws, "one-off")).toHaveLength(1);
    expect(placedAs(ws, "one-off")[0]?.why).toContain("not a job");
    expect(listLoops(ws)).toHaveLength(0);
  });

  it("will not place a session that is not attached, and says what is", () => {
    const { ws, result } = call(
      "place_session",
      { session: "claude-code-99999", as: "loop", why: "because", from: "a" },
      attached(),
    );
    expect(listLoops(ws)).toHaveLength(0);
    expect(result).toContain("claude-code-99999");
    expect(result).toContain("claude-code-34652");
  });

  it("needs a verdict and a reason, not just a session", () => {
    const { result } = call("place_session", { session: "claude-code-34652" }, attached());
    expect(result).toContain("why");
  });

  it("empties the waiting list as it goes, which is the job being done", () => {
    let ws = attached();
    expect(unplaced(ws)).toHaveLength(3);
    for (const id of RUNNING.map((session) => session.id)) {
      ws = call("place_session", { session: id, as: "one-off", why: "not a loop", from: "a" }, ws).ws;
    }
    expect(unplaced(ws)).toHaveLength(0);
    const listed = JSON.parse(call("list_attached", {}, ws).result) as { note: string };
    expect(listed.note).toContain("Every attached session has a verdict");
  });
});

describe("a session becoming a loop obeys the loop rules", () => {
  const top: Loop = {
    id: "top-loop",
    name: "morning call",
    does: "put the day's call in front of Nawaf",
    layer: 2,
    host: "Nawaf's Codex",
    state: "idle",
    records: [],
    createdAt: AT,
    updatedAt: AT,
  };

  it("feeds a loop above it", () => {
    const ws = call(
      "place_session",
      {
        session: "claude-code-36048",
        as: "loop",
        why: "its output is what the call is made of",
        name: "spidey build",
        layer: 0,
        feeds: "morning call",
        from: "a",
      },
      putLoop(attached(), top),
    ).ws;
    expect(listLoops(ws).find((loop) => loop.name === "spidey build")?.feeds).toBe("top-loop");
  });

  it("is refused when it would feed downward, by the same rule and the same words", () => {
    // The refusal is not re-implemented here; the loops module owns it. If that ever
    // stops being true this test goes red rather than a second copy silently drifting.
    const start = putLoop(attached(), top);
    const { ws, result } = call(
      "place_session",
      {
        session: "claude-code-36048",
        as: "loop",
        why: "trying it the wrong way up",
        name: "above the top",
        layer: 4,
        feeds: "morning call",
        from: "a",
      },
      start,
    );
    expect(listLoops(ws).some((loop) => loop.name === "above the top")).toBe(false);
    expect(result.length).toBeGreaterThan(20);
    expect(listSessions(ws).find((s) => s.id === "claude-code-36048")?.placement).toBe("unplaced");
  });

  it("says so when the loop it was told to feed is not there", () => {
    const { ws, result } = call(
      "place_session",
      { session: "claude-code-36048", as: "loop", why: "x", name: "n", feeds: "nothing called this", from: "a" },
      attached(),
    );
    expect(result).toContain("nothing called this");
    expect(listLoops(ws)).toHaveLength(0);
  });

  it("names itself off the session when nobody gives it a name", () => {
    const ws = call(
      "place_session",
      { session: "claude-code-36048", as: "loop", why: "it keeps running", from: "a" },
      attached(),
    ).ws;
    expect(listLoops(ws)[0]?.name).toBe("Claude Code in spidey-bot");
  });
});

describe("work that is deliberately not a loop", () => {
  it("is recorded, with the reason it is not one", () => {
    const { ws, result } = call(
      "did_outside_loop",
      {
        what: "built the quarterly deck",
        why: "it was asked for once and it is finished",
        from: "Nawaf's Codex",
      },
      board(),
    );
    expect(listOutside(ws)).toHaveLength(1);
    expect(listOutside(ws)[0]?.what).toBe("built the quarterly deck");
    expect(listOutside(ws)[0]?.by).toBe("Nawaf's Codex");
    expect(result).toContain("Recorded outside the loops");
  });

  it("does not put a loop on the board", () => {
    const ws = call(
      "did_outside_loop",
      { what: "built a PowerPoint", why: "asked for once", from: "a" },
      board(),
    ).ws;
    expect(listLoops(ws)).toHaveLength(0);
    expect(listSessions(ws)).toHaveLength(0);
  });

  it("needs to say why it is not a loop", () => {
    const { ws, result } = call("did_outside_loop", { what: "something" }, board());
    expect(listOutside(ws)).toHaveLength(0);
    expect(result).toContain("why");
  });

  it("shows up beside the sessions when the board is read", () => {
    const ws = call(
      "did_outside_loop",
      { what: "built a PowerPoint", why: "asked for once", from: "a" },
      attached(),
    ).ws;
    const listed = JSON.parse(call("list_attached", {}, ws).result) as {
      outside: readonly { what: string }[];
    };
    expect(listed.outside.map((item) => item.what)).toEqual(["built a PowerPoint"]);
  });
});

describe("reading the board", () => {
  it("tells an agent where to start when nothing is attached", () => {
    expect(call("list_attached", {}, board()).result).toContain("list_sessions");
  });

  it("puts the ones still waiting first", () => {
    const ws = call(
      "place_session",
      { session: "claude-code-34652", as: "one-off", why: "finished", from: "a" },
      attached(),
    ).ws;
    const listed = JSON.parse(call("list_attached", {}, ws).result) as {
      waiting: readonly { id: string }[];
      placed: readonly { id: string }[];
    };
    expect(listed.waiting.map((row) => row.id)).not.toContain("claude-code-34652");
    expect(listed.placed.map((row) => row.id)).toEqual(["claude-code-34652"]);
    expect(listed.waiting).toHaveLength(2);
  });
});
