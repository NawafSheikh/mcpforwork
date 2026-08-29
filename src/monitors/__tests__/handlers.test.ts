import { describe, expect, it } from "vitest";

import type { Monitor, Policy, Workspace } from "../../types";
import {
  approve_draft,
  decline_draft,
  get_run_log,
  humanDecide,
  list_monitors,
  register_monitor,
  report_monitor_run,
  scheduledTaskPrompt,
  set_policy,
} from "../handlers";
import type { HandlerResult } from "../handlerTypes";

const POLICY: Policy = {
  maxAutoActionsPerRun: 2,
  thresholds: [{ field: "amount", op: "gt", value: 5000 }],
  allowlist: ["tag_record"],
  denylist: ["payment"],
  requireHumanFor: ["merge_supplier"],
};

const MONITOR: Monitor = {
  id: "mon-invoice-watch",
  name: "Invoice watch",
  category: "invoices",
  schedule: "0 8 * * *",
  policy: POLICY,
  runner: "local",
  status: "active",
  createdAt: "2026-08-28T06:00:00.000Z",
  nextRunAt: "2026-08-29T06:00:00.000Z",
};

function workspace(over: Partial<Workspace> = {}): Workspace {
  return {
    id: "ws-test",
    name: "Test workspace",
    mode: "local",
    categories: {
      invoices: { name: "invoices", createdAt: "2026-08-28T06:00:00.000Z" },
    },
    monitors: { [MONITOR.id]: MONITOR },
    runs: [],
    drafts: {},
    claims: {},
    lastWriter: {},
    feedback: {},
    audit: [],
    updatedAt: "2026-08-28T06:00:00.000Z",
    ...over,
  };
}

function nextOf(result: HandlerResult): Workspace {
  if (!result.next) {
    throw new Error(`expected a new workspace, got: ${result.result}`);
  }
  return result.next;
}

const REPORT = {
  monitorId: MONITOR.id,
  findings: ["4 invoices arrived", "2 have no purchase order"],
  drafts: [
    { kind: "tag_record", target: "INV-1001", summary: "Tag the invoice" },
    { kind: "notify_owner", target: "finance owner", summary: "Send the digest" },
    { kind: "flag_invoice", target: "INV-1002", summary: "Flag a big invoice", amount: 9000 },
    { kind: "send_payment", target: "Acme Test Ltd", summary: "Release a payment" },
    { kind: "merge_supplier", target: "Acme Test Ltd", summary: "Merge two records" },
  ],
};

describe("register_monitor", () => {
  it("registers, computes the next run, and hands back a pasteable prompt", () => {
    const result = register_monitor(
      {
        name: "Invoice watch",
        category: "invoices",
        schedule: "every morning 08:00",
        policy: POLICY,
        runner: "local",
      },
      workspace({ monitors: {} }),
    );
    const monitor = Object.values(nextOf(result).monitors)[0];
    expect(monitor?.id).toBe("mon-invoice-watch");
    expect(monitor?.schedule).toBe("0 8 * * *");
    expect(monitor?.nextRunAt).toBeDefined();
    expect(result.result).toContain("runs every day at 08:00 as local");
    expect(result.result).toContain(
      "Open https://mcpforwork.com, then call report_monitor_run for monitor mon-invoice-watch with what you found in invoices since the last run",
    );
  });

  it("keeps the scheduled-task prompt under 300 characters", () => {
    expect(scheduledTaskPrompt("mon-a", "invoices").length).toBeLessThan(300);
    expect(scheduledTaskPrompt("m".repeat(60), "c".repeat(60)).length).toBeLessThanOrEqual(300);
  });

  it("refuses a schedule it cannot read and changes nothing", () => {
    const result = register_monitor(
      { name: "Broken", category: "invoices", schedule: "sometime", policy: POLICY, runner: "local" },
      workspace(),
    );
    expect(result.next).toBeUndefined();
    expect(result.result).toContain("Could not read");
  });

  it("gives the second monitor of the same name a distinct id", () => {
    const first = nextOf(
      register_monitor(
        { name: "Invoice watch", category: "invoices", schedule: "every hour", policy: POLICY, runner: "cloud" },
        workspace({ monitors: {} }),
      ),
    );
    const second = nextOf(
      register_monitor(
        { name: "Invoice watch", category: "invoices", schedule: "every hour", policy: POLICY, runner: "cloud" },
        first,
      ),
    );
    expect(Object.keys(second.monitors).sort()).toEqual([
      "mon-invoice-watch",
      "mon-invoice-watch-2",
    ]);
  });
});

describe("report_monitor_run", () => {
  it("splits the reported drafts into auto, pending and held", () => {
    const result = report_monitor_run(REPORT, workspace());
    const next = nextOf(result);
    const drafts = Object.values(next.drafts);

    expect(drafts.map((draft) => draft.status)).toEqual([
      "auto",
      "pending",
      "held",
      "held",
      "held",
    ]);
    expect(drafts[0]?.decidedBy).toBe("policy");
    expect(drafts[2]?.heldReason).toBe("threshold:amount>5000");
    expect(drafts[3]?.heldReason).toBe("denylist:payment");
    expect(drafts[4]?.heldReason).toBe("requireHumanFor:merge_supplier");
    expect(result.result).toContain("2 finding(s), 1 auto, 1 pending, 3 held");
    expect(result.result).toContain("threshold:amount>5000");
  });

  it("records the run, stamps the monitor and moves the next run forward", () => {
    const next = nextOf(report_monitor_run(REPORT, workspace()));
    const run = next.runs[0];
    expect(next.runs).toHaveLength(1);
    expect(run?.draftIds).toHaveLength(5);
    expect(run?.findings).toEqual(REPORT.findings);
    const stamped = next.monitors[MONITOR.id];
    expect(stamped?.lastRunAt).toBeDefined();
    const upcoming = new Date(stamped?.nextRunAt ?? 0);
    expect(upcoming.getHours()).toBe(8);
    expect(upcoming.getTime()).toBeGreaterThan(new Date(stamped?.lastRunAt ?? 0).getTime());
  });

  it("spends the auto budget in report order and holds the overflow", () => {
    const result = report_monitor_run(
      {
        monitorId: MONITOR.id,
        findings: [],
        drafts: [
          { kind: "tag_record", target: "a", summary: "one" },
          { kind: "tag_record", target: "b", summary: "two" },
          { kind: "tag_record", target: "c", summary: "three" },
        ],
      },
      workspace(),
    );
    expect(Object.values(nextOf(result).drafts).map((d) => d.status)).toEqual([
      "auto",
      "auto",
      "held",
    ]);
    expect(result.result).toContain("maxAutoActionsPerRun:2");
  });

  it("refuses an unknown monitor without touching the workspace", () => {
    const result = report_monitor_run({ monitorId: "mon-nope", drafts: [] }, workspace());
    expect(result.next).toBeUndefined();
    expect(result.result).toContain("No monitor with id");
  });
});

describe("approve_draft and decline_draft", () => {
  const reported = nextOf(report_monitor_run(REPORT, workspace()));

  it("refuses a held draft and names the clause that held it", () => {
    const result = approve_draft({ draftId: "run-1-d3" }, reported);
    expect(result.next).toBeUndefined();
    expect(result.result).toContain("Refused: clause threshold:amount>5000");
    expect(result.result).toContain("A human can approve it from the Monitors tab.");
  });

  it("names the denylist and requireHumanFor clauses too", () => {
    expect(approve_draft({ draftId: "run-1-d4" }, reported).result).toContain(
      "Refused: clause denylist:payment",
    );
    expect(approve_draft({ draftId: "run-1-d5" }, reported).result).toContain(
      "Refused: clause requireHumanFor:merge_supplier",
    );
  });

  it("approves a pending draft as the agent", () => {
    const result = approve_draft({ draftId: "run-1-d2", note: "looks fine" }, reported);
    const draft = nextOf(result).drafts["run-1-d2"];
    expect(draft?.status).toBe("approved");
    expect(draft?.decidedBy).toBe("agent");
    expect(result.result).toContain("Approved run-1-d2");
    expect(result.result).toContain("looks fine");
  });

  it("declines a pending draft as the agent", () => {
    const result = decline_draft({ draftId: "run-1-d2", reason: "not needed" }, reported);
    const draft = nextOf(result).drafts["run-1-d2"];
    expect(draft?.status).toBe("declined");
    expect(draft?.decidedBy).toBe("agent");
    expect(result.result).toContain("not needed");
  });

  it("refuses to decide a draft twice or an unknown draft", () => {
    const once = nextOf(approve_draft({ draftId: "run-1-d2" }, reported));
    expect(approve_draft({ draftId: "run-1-d2" }, once).result).toContain(
      "was already approved",
    );
    expect(approve_draft({ draftId: "run-1-d1" }, reported).result).toContain(
      "already ran automatically",
    );
    expect(approve_draft({ draftId: "nope" }, reported).result).toContain("No draft with id");
  });

  it("lets a relaxed policy unblock a previously held draft", () => {
    const relaxed = nextOf(
      set_policy(
        { monitorId: MONITOR.id, policy: { ...POLICY, thresholds: [] } },
        reported,
      ),
    );
    const result = approve_draft({ draftId: "run-1-d3" }, relaxed);
    expect(nextOf(result).drafts["run-1-d3"]?.status).toBe("approved");
  });
});

describe("humanDecide", () => {
  const reported = nextOf(report_monitor_run(REPORT, workspace()));

  it("approves a held draft, records the human, and writes an audit line", () => {
    const result = humanDecide(reported, "run-1-d3", "approved", "checked with finance");
    const next = nextOf(result);
    const draft = next.drafts["run-1-d3"];
    expect(draft?.status).toBe("approved");
    expect(draft?.decidedBy).toBe("human");
    const event = next.audit.at(-1);
    expect(event?.actor).toBe("human");
    expect(event?.tool).toBe("approve_draft");
    expect(event?.argsHash).toMatch(/^fnv1a64:[a-f0-9]{16}$/);
    expect(event?.ok).toBe(true);
  });

  it("declines a held draft and never refuses", () => {
    const next = nextOf(humanDecide(reported, "run-1-d5", "declined"));
    expect(next.drafts["run-1-d5"]?.status).toBe("declined");
    expect(next.audit.at(-1)?.tool).toBe("decline_draft");
  });

  it("reports an unknown draft instead of throwing", () => {
    const result = humanDecide(reported, "nope", "approved");
    expect(result.next).toBeUndefined();
    expect(result.result).toContain("No draft with id");
  });
});

describe("read tools and set_policy", () => {
  const reported = nextOf(report_monitor_run(REPORT, workspace()));

  it("lists monitors as JSON with the last and next run", () => {
    const rows = JSON.parse(list_monitors({}, reported).result) as unknown[];
    const first = rows[0] as Record<string, unknown>;
    expect(rows).toHaveLength(1);
    expect(first["id"]).toBe(MONITOR.id);
    expect(first["lastRunAt"]).not.toBeNull();
    expect(String(first["policy"])).toContain("at most 2");
  });

  it("returns run logs with findings and draft statuses, newest first", () => {
    const runs = JSON.parse(get_run_log({ monitorId: MONITOR.id }, reported).result) as {
      findings: string[];
      drafts: { status: string; heldReason: string | null }[];
    }[];
    expect(runs).toHaveLength(1);
    expect(runs[0]?.findings).toEqual(REPORT.findings);
    expect(runs[0]?.drafts.map((draft) => draft.status)).toContain("held");
    expect(runs[0]?.drafts[2]?.heldReason).toBe("threshold:amount>5000");
  });

  it("replaces a policy and summarises the diff", () => {
    const result = set_policy(
      { monitorId: MONITOR.id, policy: { ...POLICY, maxAutoActionsPerRun: 5 } },
      reported,
    );
    expect(nextOf(result).monitors[MONITOR.id]?.policy.maxAutoActionsPerRun).toBe(5);
    expect(result.result).toContain("maxAutoActionsPerRun: 2 -> 5");
  });

  it("refuses set_policy for an unknown monitor", () => {
    const result = set_policy({ monitorId: "mon-nope", policy: POLICY }, reported);
    expect(result.next).toBeUndefined();
    expect(result.result).toContain("needs a known monitorId");
  });
});
