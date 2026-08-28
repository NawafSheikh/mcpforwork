/**
 * Onboarding checks: the replay script and engine, the hero branches, the ribbon logic.
 * The engine tests drive a real in-memory store, so they fail if the audit trail or the
 * workspace shape drifts away from what a real agent run produces.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { Hero, HERO_TITLE, HERO_TITLE_LIVE, REPLAY_LABEL, SITE_URL } from "../Hero";
import { ReplayHost } from "../ReplayHost";
import { SampleRibbon, SAMPLE_RIBBON_TEXT, isSampleWorkspace } from "../SampleRibbon";
import { REPLAY_CALLER, replayNeedsConfirm, startReplay } from "../replay";
import { REPLAY_PACING, buildReplaySteps, replayDurationMs } from "../replaySteps";
import { createReplayController } from "../replayController";
import { ShellProvider } from "../../shell/context";
import { ToastProvider } from "../../shell/Toasts";
import { STARTER_PROMPT } from "../../shell/lib/constants";
import { createWorkspaceStore, emptyWorkspace } from "../../store";
import { sampleWorkspace } from "../../demo/sampleWorkspace";
import type { Workspace } from "../../types";

const FIXED = new Date("2026-08-28T09:00:00.000Z");

function statusStore(available: boolean, registered = 0) {
  return { get: () => ({ available, registered }), subscribe: () => () => undefined };
}

function render(node: ReactNode, available: boolean, registered = 0, seeded?: Workspace): string {
  const store = createWorkspaceStore(
    seeded ? { mode: "demo", initial: seeded, persist: false } : { mode: "demo", persist: false },
  );
  return renderToStaticMarkup(
    <ShellProvider store={store} statusStore={statusStore(available, registered)}>
      <ToastProvider>{node}</ToastProvider>
    </ShellProvider>,
  );
}

describe("replay script", () => {
  const steps = buildReplaySteps(FIXED);

  it("starts empty and then builds in a human order", () => {
    const ids = steps.map((step) => step.id);
    expect(ids[0]).toBe("clear");
    expect(ids.filter((id) => id.startsWith("category:")).length).toBe(4);
    expect(ids.indexOf("category:Invoices")).toBeLessThan(ids.indexOf("summary:Invoices"));
    expect(ids.indexOf("summary:Invoices")).toBeLessThan(ids.indexOf("dashboard:Invoices"));
    expect(ids.indexOf("dashboard:Newsletters")).toBeLessThan(ids.indexOf("overview"));
    expect(ids.indexOf("overview")).toBeLessThan(ids.indexOf("monitor:mon_invoices_demo"));
    expect(ids.indexOf("monitor:mon_tickets_demo")).toBeLessThan(ids.indexOf("run:run_tick_0001"));
    expect(ids.indexOf("run:run_inv_0001")).toBeLessThan(ids.indexOf("refusal:draft_inv_001"));
    expect(ids[ids.length - 1]).toBe("run:run_inv_0002");
  });

  it("runs between 45 and 60 seconds at speed 1", () => {
    const total = replayDurationMs(steps);
    expect(total).toBeGreaterThanOrEqual(45_000);
    expect(total).toBeLessThanOrEqual(60_000);
  });

  it("narrates every step in one sentence and names the held clause", () => {
    for (const step of steps) {
      expect(step.caption.length).toBeGreaterThan(10);
      expect(step.caption.length).toBeLessThan(120);
      expect(step.caption).not.toContain(String.fromCharCode(0x2014));
    }
    const refusal = steps.find((step) => step.id === "refusal:draft_inv_001");
    expect(refusal?.caption).toContain("threshold:amount>5000");
    expect(refusal?.caption).toContain("EUR 6,300");
    expect(refusal?.ok).toBe(false);
  });

  it("keeps every step immutable", () => {
    const before = emptyWorkspace("demo");
    const after = steps[1]?.apply(before);
    expect(Object.keys(before.categories).length).toBe(0);
    expect(Object.keys(after?.categories ?? {}).length).toBe(1);
  });
});

describe("replay engine", () => {
  it("refuses to clobber a board that already has content", () => {
    const seeded = sampleWorkspace(FIXED);
    const store = createWorkspaceStore({ mode: "demo", initial: seeded, persist: false });
    let blocked = 0;
    expect(replayNeedsConfirm(store.get())).toBe(true);

    const stop = startReplay(store, { now: FIXED, onBlocked: () => (blocked += 1) });
    expect(blocked).toBe(1);
    expect(Object.keys(store.get().categories).length).toBe(4);
    expect(store.get().audit.length).toBe(seeded.audit.length);
    stop();
  });

  it("clears first, then builds the whole board through the store", () => {
    vi.useFakeTimers();
    try {
      const seeded = sampleWorkspace(FIXED);
      const store = createWorkspaceStore({ mode: "demo", initial: seeded, persist: false });
      const stop = startReplay(store, { now: FIXED, force: true });

      expect(Object.keys(store.get().categories).length).toBe(0);
      expect(store.get().overview).toBeUndefined();

      vi.advanceTimersByTime(replayDurationMs(buildReplaySteps(FIXED)) + 1000);

      const ws = store.get();
      expect(Object.keys(ws.categories).length).toBe(4);
      expect(ws.overview).toBeDefined();
      expect(Object.keys(ws.monitors).length).toBe(2);
      expect(ws.runs.length).toBe(3);
      expect(Object.values(ws.drafts).filter((d) => d.status === "held").length).toBe(2);
      expect(stop.state().phase).toBe("done");
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("audits every step as the agent, with the replay caller", () => {
    vi.useFakeTimers();
    try {
      const store = createWorkspaceStore({ mode: "demo", persist: false });
      const stop = startReplay(store, { now: FIXED });
      vi.advanceTimersByTime(REPLAY_PACING.clear + 10);
      const events = store.get().audit;
      expect(events.length).toBe(2);
      expect(events.every((event) => event.actor === "agent")).toBe(true);
      expect(events.every((event) => event.caller === REPLAY_CALLER)).toBe(true);
      expect(events[0]?.tool).toBe("clear_workspace");
      expect(events[1]?.tool).toBe("create_category");
      expect(events[1]?.argsPreview).toContain("Invoices");
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("pauses, resumes, doubles speed and stops for good", () => {
    vi.useFakeTimers();
    try {
      const store = createWorkspaceStore({ mode: "demo", persist: false });
      const stop = startReplay(store, { now: FIXED });

      stop.pause();
      vi.advanceTimersByTime(20_000);
      expect(stop.state().index).toBe(1);
      expect(stop.state().phase).toBe("paused");

      stop.resume();
      stop.setSpeed(2);
      vi.advanceTimersByTime(REPLAY_PACING.clear / 2 + 10);
      expect(stop.state().index).toBe(2);
      expect(stop.state().speed).toBe(2);

      stop();
      const frozen = store.get().audit.length;
      vi.advanceTimersByTime(60_000);
      expect(store.get().audit.length).toBe(frozen);
      expect(stop.state().phase).toBe("stopped");
    } finally {
      vi.useRealTimers();
    }
  });

  it("asks before replacing a board, and starts once confirmed", () => {
    const controller = createReplayController();
    const store = createWorkspaceStore({
      mode: "demo",
      initial: sampleWorkspace(FIXED),
      persist: false,
    });

    controller.request(store);
    expect(controller.get().phase).toBe("confirm");

    controller.cancel();
    expect(controller.get().phase).toBe("idle");
    expect(Object.keys(store.get().categories).length).toBe(4);

    controller.confirm(store);
    expect(controller.get().phase).toBe("running");
    expect(Object.keys(store.get().categories).length).toBe(0);
    controller.dismiss();
  });
});

describe("hero", () => {
  it("tells a normal browser what this page is and what to do", () => {
    const html = render(<Hero />, false);
    expect(html).toContain(HERO_TITLE);
    expect(html).toContain("You do not use this page directly");
    expect(html).toContain("Toggle side panel");
    expect(html).toContain(SITE_URL);
    expect(html).toContain("group them into");
    expect(html).toContain(REPLAY_LABEL);
    expect(html).toContain("See a finished example");
    expect(html).not.toContain(HERO_TITLE_LIVE);
  });

  it("mirrors the connected pill and leads with the prompt inside ChatGPT", () => {
    const html = render(<Hero />, true, 18);
    expect(html).toContain(HERO_TITLE_LIVE);
    expect(html).toContain("18 registered");
    expect(html).toContain("Copy the starter prompt");
    expect(html).toContain("Paste it into the chat beside this page");
    expect(html).toContain(STARTER_PROMPT.slice(0, 30));
    expect(html).not.toContain(HERO_TITLE);
  });
});

describe("sample ribbon", () => {
  it("recognises the seeded sample and nothing else", () => {
    expect(isSampleWorkspace(sampleWorkspace(FIXED))).toBe(true);
    expect(isSampleWorkspace(emptyWorkspace("demo"))).toBe(false);
    const own: Workspace = {
      ...emptyWorkspace("demo"),
      categories: {
        Mine: { name: "Mine", createdAt: FIXED.toISOString(), provenance: "from my own mail" },
      },
    };
    expect(isSampleWorkspace(own)).toBe(false);
  });

  it("shows on the example board and stays away from a real one", () => {
    const shown = render(<SampleRibbon />, false, 0, sampleWorkspace(FIXED));
    expect(shown).toContain(SAMPLE_RIBBON_TEXT);
    expect(shown).toContain("Start fresh");
    expect(render(<SampleRibbon />, false)).not.toContain("mfw-sample-ribbon");
  });

  it("keeps the replay host invisible until a replay starts", () => {
    expect(render(<ReplayHost />, false)).not.toContain("mfw-replay");
  });
});
