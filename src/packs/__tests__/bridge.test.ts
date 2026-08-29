/**
 * The local bridge, against a fake socket.
 *
 * The bridge is a separate project and no robot is anywhere near this suite: the socket
 * is injected, so these tests drive the wire protocol of mcpforwork-bridge/docs/CONTRACT.md
 * frame by frame and assert what the page does with each one.
 */
import { afterEach, describe, expect, it } from "vitest";
import { BridgeClient, acceptPacks, refusalFor, type BridgePack } from "../bridge";
import { createBridgeSession, eventText } from "../bridgeSession";
import { helloPayload, verifyHello } from "../bridgeIdentity";
import { packToasts } from "../events";
import { fakeContext, fakeSocket, installContext, removeContext, type FakeSocket } from "./fixtures";

const tool = (name: string) => ({
  name,
  description: `does ${name}`,
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: false },
});

const robot = {
  name: "Spot",
  kind: "legged",
  frame: { units: "cm", origin: "dock" },
  capabilities: ["walk", "turn", "say"],
  limits: { maxMoveCm: 40, minClearanceCm: 25 },
  sensors: ["camera", "range"],
  safety: { stop: true, boundary: true },
  owner: "Ana",
  fingerprint: "9f2c11aa33bb",
};

const teamsPack: BridgePack = {
  id: "teams",
  name: "Teams",
  description: "Read a channel and post a message.",
  risk: "send",
  tools: [tool("teams_read"), tool("teams_post")],
};

const robotPack: BridgePack = {
  id: "robot",
  name: "Robot",
  description: "Walk, turn, look.",
  risk: "move",
  tools: [tool("robot_walk")],
  robot,
};

const hello = (packs: readonly BridgePack[]) => ({ t: "hello", version: "0.1.0", packs });

let socket: FakeSocket | null = null;

afterEach(() => {
  socket = null;
  packToasts.clear();
  removeContext();
});

function client(): { readonly bridge: BridgeClient; readonly wire: FakeSocket } {
  const wire = fakeSocket();
  socket = wire;
  return { bridge: new BridgeClient("ws://127.0.0.1:7331", () => wire.socket), wire };
}

describe("bridge client", () => {
  it("settles on hello and exposes the packs and the robots", async () => {
    const { bridge, wire } = client();
    const settled = bridge.connect();
    wire.deliver(hello([teamsPack, robotPack]));

    const answer = await settled;

    expect(answer.version).toBe("0.1.0");
    expect(bridge.packs.map((pack) => pack.id)).toEqual(["teams", "robot"]);
    expect(bridge.robots.map((item) => item.name)).toEqual(["Spot"]);
  });

  it("sends a call frame with the caller and settles on the matching result", async () => {
    const { bridge, wire } = client();
    const settled = bridge.connect();
    wire.deliver(hello([teamsPack]));
    await settled;

    const call = bridge.call("teams_post", { text: "hi" }, "maria-agent", "agent");
    const frame = wire.frames.at(-1);
    expect(frame?.t).toBe("call");
    expect(frame?.tool).toBe("teams_post");
    expect(frame?.caller).toBe("maria-agent");
    expect(frame?.who).toBe("agent");

    wire.deliver({ t: "result", id: frame?.id, ok: true, result: "Posted." });
    await expect(call).resolves.toEqual({ ok: true, result: "Posted." });
  });

  it("hands a refusal back as a string rather than dropping the connection", async () => {
    const { bridge, wire } = client();
    const settled = bridge.connect();
    wire.deliver(hello([robotPack]));
    await settled;

    const call = bridge.call("robot_walk", { cm: 200 }, "Ana", "person");
    wire.deliver({ t: "result", id: wire.frames.at(-1)?.id, ok: false, result: "boundary:floor" });

    await expect(call).resolves.toEqual({ ok: false, result: "boundary:floor" });
    expect(bridge.connected).toBe(true);
  });

  it("passes events to listeners and rejects pending calls when the socket drops", async () => {
    const { bridge, wire } = client();
    const settled = bridge.connect();
    wire.deliver(hello([robotPack]));
    await settled;
    const seen: string[] = [];
    bridge.onEvent((event) => seen.push(event.kind));

    wire.deliver({ t: "event", kind: "queue.refused", payload: { clause: "boundary:floor" } });
    const pending = bridge.call("robot_walk", {}, "Ana");
    wire.drop();

    await expect(pending).rejects.toThrow("disconnected");
    expect(seen).toEqual(["queue.refused", "bridge.disconnected"]);
  });

  it("refuses to call without a connection", async () => {
    const { bridge } = client();
    await expect(bridge.call("robot_walk", {}, "Ana")).rejects.toThrow("not connected");
  });
});

describe("what the page refuses", () => {
  it("drops a moving pack with no profile, or one that cannot be stopped", () => {
    const noProfile: BridgePack = { ...robotPack, robot: undefined };
    const noStop: BridgePack = { ...robotPack, robot: { ...robot, safety: { stop: false, boundary: true } } };

    expect(refusalFor(teamsPack)).toBeNull();
    expect(refusalFor(robotPack)).toBeNull();
    expect(refusalFor(noProfile)).toContain("must carry a robot profile");
    expect(refusalFor(noStop)).toContain("stop and a boundary");

    const outcome = acceptPacks([teamsPack, noProfile, robotPack]);
    expect(outcome.packs.map((pack) => pack.id)).toEqual(["teams", "robot"]);
    expect(outcome.refused).toHaveLength(1);
  });

  it("marks a hello with no identity unverified rather than trusted", async () => {
    await expect(verifyHello({ version: "0.1.0", packs: [teamsPack] })).resolves.toBe("unverified");
  });

  it("signs exactly the pack list the bridge offered", () => {
    expect(helloPayload("0.1.0", "9f2c", [teamsPack, robotPack])).toBe(
      JSON.stringify({ v: "0.1.0", f: "9f2c", p: ["teams:send:2", "robot:move:1"] }),
    );
  });
});

describe("bridge session", () => {
  it("registers every accepted pack, switches one off, and clears out on disconnect", async () => {
    const context = fakeContext();
    installContext(context);
    const wire = fakeSocket();
    const session = createBridgeSession({ socket: () => wire.socket, caller: () => "Ana" });

    const connected = session.connect();
    wire.deliver(hello([teamsPack, robotPack]));
    await connected;

    expect(session.get().status).toBe("on");
    expect(session.get().registered).toBe(3);
    expect(context.tools.has("robot_walk")).toBe(true);
    expect(session.get().packs.find((pack) => pack.id === "robot")?.robot?.name).toBe("Spot");

    session.setPack("robot", false);
    expect(context.tools.has("robot_walk")).toBe(false);
    expect(context.tools.has("teams_post")).toBe(true);

    session.disconnect();
    expect(context.tools.size).toBe(0);
    expect(session.get().status).toBe("off");
  });

  it("calls the bridge through the registered tool and passes the caller through", async () => {
    const context = fakeContext();
    installContext(context);
    const wire = fakeSocket();
    const session = createBridgeSession({ socket: () => wire.socket, caller: () => "Ana" });
    const connected = session.connect();
    wire.deliver(hello([teamsPack]));
    await connected;

    const answer = context.tools.get("teams_post")?.execute({ caller: "maria-agent", text: "hi" });
    const frame = wire.frames.at(-1);
    expect(frame?.caller).toBe("maria-agent");
    wire.deliver({ t: "result", id: frame?.id, ok: true, result: "Posted." });

    await expect(answer).resolves.toBe("Posted.");
  });

  it("names the pack when the bridge refuses, and falls back to the page name", async () => {
    const context = fakeContext();
    installContext(context);
    const wire = fakeSocket();
    const session = createBridgeSession({ socket: () => wire.socket, caller: () => "Ana" });
    const connected = session.connect();
    wire.deliver(hello([robotPack]));
    await connected;

    const answer = context.tools.get("robot_walk")?.execute({ cm: 200 });
    const frame = wire.frames.at(-1);
    expect(frame?.caller).toBe("Ana");
    wire.deliver({ t: "result", id: frame?.id, ok: false, result: "boundary:floor" });

    await expect(answer).resolves.toContain("Refused by Robot");
  });

  it("shows queue events as toasts and unregisters everything when the bridge goes", async () => {
    const context = fakeContext();
    installContext(context);
    const wire = fakeSocket();
    const session = createBridgeSession({ socket: () => wire.socket, caller: () => "Ana" });
    const connected = session.connect();
    wire.deliver(hello([robotPack]));
    await connected;
    const seen: string[] = [];
    packToasts.subscribe((toast) => seen.push(toast.text));

    wire.deliver({ t: "event", kind: "queue.refused", payload: { clause: "boundary:floor", tool: "robot_walk" } });
    wire.drop();

    expect(seen[0]).toContain("boundary:floor");
    expect(seen.at(-1)).toContain("disconnected");
    expect(context.tools.size).toBe(0);
    expect(session.get().packs).toHaveLength(0);
  });

  it("says what each queue event was in one line", () => {
    expect(eventText({ kind: "queue.refused", payload: { clause: "boundary:wall" } })).toContain(
      "Nothing moved",
    );
    expect(eventText({ kind: "queue.enqueued", payload: { tool: "robot_walk" } })).toContain("Queued");
    expect(eventText({ kind: "recipe.trial", payload: null })).toContain("recipe");
  });
});
