/**
 * The attach dialog, rendered for real, with effects running.
 *
 * Every other rendering test in this repo uses renderToStaticMarkup, which never runs an
 * effect. That is fine for markup and useless here, because the bug this file exists for
 * was an effect that re-fired for ever:
 *
 *   useBridge() spreads its state into a NEW object on every render, so depending on
 *   `bridge` made the "ask the machine" callback unstable, which re-ran the effect, which
 *   called setFound(null), which re-rendered. The bridge answered list_sessions in a
 *   second and the dialog sat on "Asking your machine..." indefinitely. Nothing was
 *   thrown, nothing was logged, and 787 unit tests were green.
 *
 * So these mount the component into jsdom and count how many times the machine is asked.
 * One click, one question.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AttachSessions, howLong, readFound, skipKey } from "../ui/AttachSessions";
import { ShellProvider } from "../../shell/context";
import { createWorkspaceStore } from "../../store";
import * as useBridgeModule from "../../packs/useBridge";
import type { BridgeApi } from "../../packs/useBridge";
import { listSessions } from "../state";

const REAL = JSON.stringify({
  sessions: [
    { id: "claude-code-34652", kind: "claude-code", what: "claude --resume", minutes: 682 },
    { id: "claude-code-36048", kind: "claude-code", what: "claude.exe --resume 1359", where: "spidey-bot", minutes: 1243 },
    { id: "chatgpt-desktop-3368", kind: "chatgpt-desktop", what: "ChatGPT.exe", minutes: 4343 },
  ],
  hidden: 595,
});

let container: HTMLElement;
let root: Root;
let store: ReturnType<typeof createWorkspaceStore>;

/**
 * A stand-in for useBridge that fails the same way the real one can.
 *
 * This is the part that matters. The first version of this file mocked useBridge with
 * mockReturnValue, which hands back the SAME object on every render, and that erased the
 * exact instability the bug was made of: the broken component passed all thirteen tests.
 *
 * The real hook spreads its state into a fresh object each render while its callbacks stay
 * useCallback-stable, so the fake does that too: `spread` is new every time, `call` never
 * changes. A component that depends on the object re-runs its effect for ever; one that
 * depends on the callback asks once.
 */
function fakeBridgeFactory(
  status: BridgeApi["status"],
  answer: string,
  asked: { count: number },
): () => BridgeApi {
  const call = async (): Promise<{ ok: boolean; result: string }> => {
    asked.count += 1;
    return { ok: true, result: answer };
  };
  const connect = (): void => undefined;
  const disconnect = (): void => undefined;
  const setPack = (): void => undefined;
  return () => makeBridge(status, call, connect, disconnect, setPack);
}

function makeBridge(
  status: BridgeApi["status"],
  call: () => Promise<{ ok: boolean; result: string }>,
  connect: () => void,
  disconnect: () => void,
  setPack: () => void,
): BridgeApi {
  return {
    status,
    url: "ws://127.0.0.1:7331",
    version: "0.1.0",
    fingerprint: "",
    verdict: "unverified",
    packs: [],
    robots: [],
    refused: [],
    error: "",
    connect,
    disconnect,
    setPack,
    call,
  } as unknown as BridgeApi;
}

async function mount(next: () => BridgeApi): Promise<void> {
  // mockImplementation, never mockReturnValue: see the note on fakeBridgeFactory.
  vi.spyOn(useBridgeModule, "useBridge").mockImplementation(next);
  await act(async () => {
    root.render(
      <ShellProvider store={store} statusStore={statusStore}>
        <AttachSessions />
      </ShellProvider>,
    );
  });
}

/** The shell wants the WebMCP status store too; the dialog never reads it. */
const statusStore = {
  get: () => ({ available: true, registered: 47 }),
  subscribe: () => () => undefined,
};

const text = (): string => container.textContent ?? "";
const rows = (): readonly Element[] => [...container.querySelectorAll(".mfw-attach__row-item")];

beforeEach(() => {
  store = createWorkspaceStore({ mode: "local", persist: false });
  try {
    globalThis.localStorage?.removeItem(skipKey(store.get().id));
  } catch {
    /* no storage is the same as nothing remembered */
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("asking the machine", () => {
  it("asks exactly once when the bridge is already on", async () => {
    // The regression. Before the fix this number climbed with every render.
    const asked = { count: 0 };
    await mount(fakeBridgeFactory("on", REAL, asked));
    await act(async () => {
      await Promise.resolve();
    });
    expect(asked.count).toBe(1);
  });

  it("does not stay on the waiting line once the answer is in", async () => {
    const asked = { count: 0 };
    await mount(fakeBridgeFactory("on", REAL, asked));
    await act(async () => {
      await Promise.resolve();
    });
    expect(text()).not.toContain("Asking your machine");
    expect(rows()).toHaveLength(3);
  });

  it("shows what is running, by kind and by project", async () => {
    await mount(fakeBridgeFactory("on", REAL, { count: 0 }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(text()).toContain("Claude Code");
    expect(text()).toContain("ChatGPT desktop");
    expect(text()).toContain("spidey-bot");
  });

  it("never ticks anything on the person's behalf", async () => {
    await mount(fakeBridgeFactory("on", REAL, { count: 0 }));
    await act(async () => {
      await Promise.resolve();
    });
    const boxes = [...container.querySelectorAll<HTMLInputElement>(".mfw-attach__row-item input")];
    expect(boxes).toHaveLength(3);
    expect(boxes.every((box) => !box.checked)).toBe(true);
    // And with nothing ticked there is nothing to attach.
    const attach = [...container.querySelectorAll("button")].find((b) => b.textContent === "Attach");
    expect((attach as HTMLButtonElement | undefined)?.disabled).toBe(true);
  });
});

describe("attaching what was ticked", () => {
  it("puts only the ticked ones on the board", async () => {
    await mount(fakeBridgeFactory("on", REAL, { count: 0 }));
    await act(async () => {
      await Promise.resolve();
    });

    const boxes = [...container.querySelectorAll<HTMLInputElement>(".mfw-attach__row-item input")];
    await act(async () => {
      boxes[0]?.click();
      boxes[2]?.click();
    });
    const attach = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").startsWith("Attach"),
    );
    await act(async () => {
      (attach as HTMLButtonElement).click();
      await Promise.resolve();
    });

    const attached = listSessions(store.get());
    expect(attached.map((session) => session.id)).toEqual([
      "claude-code-34652",
      "chatgpt-desktop-3368",
    ]);
    expect(attached.every((session) => session.placement === "unplaced")).toBe(true);
  });

  it("says what still has to happen, in the words of the tool that does it", async () => {
    await mount(fakeBridgeFactory("on", REAL, { count: 0 }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      container.querySelector<HTMLInputElement>(".mfw-attach__row-item input")?.click();
    });
    const attach = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").startsWith("Attach"),
    );
    await act(async () => {
      (attach as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(text()).toContain("place_session");
  });
});

describe("when there is no bridge", () => {
  it("says how to attach one instead of showing an empty list", async () => {
    await mount(fakeBridgeFactory("off", REAL, { count: 0 }));
    expect(text()).toContain("mcpforwork-bridge");
    expect(text()).toContain("Connect the bridge");
    expect(rows()).toHaveLength(0);
  });

  it("does not ask a machine that is not connected", async () => {
    const asked = { count: 0 };
    await mount(fakeBridgeFactory("off", REAL, asked));
    await act(async () => {
      await Promise.resolve();
    });
    expect(asked.count).toBe(0);
  });
});

describe("asking once, and only once", () => {
  it("stays shut on a board that has already been asked", async () => {
    globalThis.localStorage?.setItem(skipKey(store.get().id), "1");
    await mount(fakeBridgeFactory("on", REAL, { count: 0 }));
    expect(container.querySelector(".mfw-attach")).toBeNull();
  });

  it("remembers a skip, so it does not reappear", async () => {
    await mount(fakeBridgeFactory("on", REAL, { count: 0 }));
    const notNow = [...container.querySelectorAll("button")].find((b) => b.textContent === "Not now");
    await act(async () => {
      (notNow as HTMLButtonElement).click();
    });
    expect(container.querySelector(".mfw-attach")).toBeNull();
    expect(globalThis.localStorage?.getItem(skipKey(store.get().id))).toBe("1");
  });
});

describe("reading what the bridge said", () => {
  it("keeps the rows it understands and drops the rest", () => {
    const mixed = JSON.stringify({
      sessions: [
        { id: "a", kind: "claude-code", what: "claude" },
        { id: "b", kind: "not-a-kind", what: "x" },
        { id: "", kind: "codex", what: "y" },
        { id: "d", kind: "terminal" },
      ],
    });
    expect(readFound(mixed).map((row) => row.id)).toEqual(["a"]);
  });

  it("survives a bridge that answers with something else entirely", () => {
    expect(readFound("not json")).toEqual([]);
    expect(readFound("{}")).toEqual([]);
    expect(readFound('{"sessions":"lots"}')).toEqual([]);
  });

  it("says how long in a unit a person reads", () => {
    expect(howLong(45)).toBe("45m");
    expect(howLong(682)).toBe("11h");
    expect(howLong(4343)).toBe("3d");
    expect(howLong(undefined)).toBe("");
  });
});
