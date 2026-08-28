/**
 * Monitors, runs, drafts and audit events for the demo workspace.
 * Two monitors, three runs, six drafts across auto / pending / held, eight audit events.
 * Held drafts carry the clause string the policy engine produced, in the same
 * "clause:expression" shape the UI and the approve_draft refusal message use.
 */
import type { AuditEvent, DraftAction, Monitor, MonitorRun, OverviewSpec } from "../types";
import type { DemoClock } from "./clock";

export const DEMO_MONITOR_INVOICES = "mon_invoices_demo";
export const DEMO_MONITOR_TICKETS = "mon_tickets_demo";

/** Clause strings, kept as constants so the demo and the tests never drift apart. */
export const CLAUSE_AMOUNT = "threshold:amount>5000";
export const CLAUSE_REQUIRE_HUMAN_PAY = "requireHumanFor:pay";

export function sampleMonitors(clock: DemoClock): Readonly<Record<string, Monitor>> {
  const invoices: Monitor = {
    id: DEMO_MONITOR_INVOICES,
    name: "Invoice watch",
    category: "Invoices",
    schedule: "every morning 08:00",
    runner: "local",
    status: "active",
    createdAt: clock.at(-2880),
    lastRunAt: clock.at(-140),
    nextRunAt: clock.nextDailyAt(8),
    policy: {
      maxAutoActionsPerRun: 2,
      thresholds: [{ field: "amount", op: "gt", value: 5000, label: "large payment" }],
      requireHumanFor: ["pay"],
      allowlist: ["label", "reply_draft"],
      notes: "Draft replies and labels are fine. Money moves are mine.",
    },
  };
  const tickets: Monitor = {
    id: DEMO_MONITOR_TICKETS,
    name: "Ticket triage",
    category: "Customer tickets",
    schedule: "every hour",
    runner: "local",
    status: "active",
    createdAt: clock.at(-2820),
    lastRunAt: clock.at(-40),
    nextRunAt: clock.nextHourTop(),
    policy: {
      maxAutoActionsPerRun: 3,
      allowlist: ["label", "assign"],
      denylist: ["refund"],
      notes: "Label and assign freely, never touch refunds.",
    },
  };
  return Object.freeze({ [invoices.id]: invoices, [tickets.id]: tickets });
}

export function sampleDrafts(clock: DemoClock): Readonly<Record<string, DraftAction>> {
  const list: readonly DraftAction[] = [
    {
      id: "draft_inv_001",
      monitorId: DEMO_MONITOR_INVOICES,
      runId: "run_inv_0001",
      kind: "pay",
      target: "Acme Test Ltd INV-2041",
      summary: "Pay invoice INV-2041 for EUR 6,300, 27 days old.",
      amount: 6300,
      fields: { supplier: "Acme Test Ltd", invoice: "INV-2041", currency: "EUR" },
      status: "held",
      heldReason: CLAUSE_AMOUNT,
    },
    {
      id: "draft_inv_002",
      monitorId: DEMO_MONITOR_INVOICES,
      runId: "run_inv_0001",
      kind: "reply_draft",
      target: "Sample Supplies GmbH INV-2044",
      summary: "Draft a reply asking Sample Supplies GmbH to confirm the delivery date.",
      fields: { supplier: "Sample Supplies GmbH", invoice: "INV-2044" },
      status: "pending",
    },
    {
      id: "draft_tick_001",
      monitorId: DEMO_MONITOR_TICKETS,
      runId: "run_tick_0001",
      kind: "label",
      target: "Ticket 4471",
      summary: "Label ticket 4471 from Acme Test Ltd as Billing.",
      fields: { customer: "Acme Test Ltd", label: "Billing" },
      status: "auto",
      decidedBy: "policy",
      decidedAt: clock.at(-39),
    },
    {
      id: "draft_tick_002",
      monitorId: DEMO_MONITOR_TICKETS,
      runId: "run_tick_0001",
      kind: "assign",
      target: "Ticket 4472",
      summary: "Assign ticket 4472 from Example Retail NV to the export queue.",
      fields: { customer: "Example Retail NV", queue: "export" },
      status: "auto",
      decidedBy: "policy",
      decidedAt: clock.at(-39),
    },
    {
      id: "draft_inv_003",
      monitorId: DEMO_MONITOR_INVOICES,
      runId: "run_inv_0002",
      kind: "pay",
      target: "Demo Print Co INV-2055",
      summary: "Pay invoice INV-2055 for EUR 2,750, inside the threshold but a money move.",
      amount: 2750,
      fields: { supplier: "Demo Print Co", invoice: "INV-2055", currency: "EUR" },
      status: "held",
      heldReason: CLAUSE_REQUIRE_HUMAN_PAY,
    },
    {
      id: "draft_inv_004",
      monitorId: DEMO_MONITOR_INVOICES,
      runId: "run_inv_0002",
      kind: "label",
      target: "Placeholder Logistics BV INV-2050",
      summary: "Label INV-2050 as Awaiting proof of delivery.",
      fields: { supplier: "Placeholder Logistics BV", label: "Awaiting POD" },
      status: "pending",
    },
  ];
  return Object.freeze(
    list.reduce<Record<string, DraftAction>>((acc, d) => ({ ...acc, [d.id]: d }), {}),
  );
}

export function sampleRuns(clock: DemoClock): readonly MonitorRun[] {
  return [
    {
      id: "run_inv_0001",
      monitorId: DEMO_MONITOR_INVOICES,
      runner: "local",
      startedAt: clock.at(-1580),
      finishedAt: clock.at(-1578),
      findings: [
        "6 unpaid invoices, EUR 9,120 outstanding.",
        "INV-2041 from Acme Test Ltd is 27 days old and over the EUR 5,000 threshold.",
      ],
      draftIds: ["draft_inv_001", "draft_inv_002"],
    },
    {
      id: "run_tick_0001",
      monitorId: DEMO_MONITOR_TICKETS,
      runner: "local",
      startedAt: clock.at(-40),
      finishedAt: clock.at(-39),
      findings: [
        "2 new tickets since the last run, both inside the allowlist.",
        "No refund requests, so nothing hit the denylist.",
      ],
      draftIds: ["draft_tick_001", "draft_tick_002"],
    },
    {
      id: "run_inv_0002",
      monitorId: DEMO_MONITOR_INVOICES,
      runner: "local",
      startedAt: clock.at(-140),
      finishedAt: clock.at(-138),
      findings: [
        "1 new invoice from Demo Print Co, EUR 2,750.",
        "Placeholder Logistics BV still has no proof of delivery attached.",
      ],
      draftIds: ["draft_inv_003", "draft_inv_004"],
    },
  ];
}

export function sampleAudit(clock: DemoClock): readonly AuditEvent[] {
  return [
    {
      id: "aud_0001",
      at: clock.at(-152),
      actor: "human",
      tool: "seed_demo_workspace",
      result: "Sample workspace loaded in demo mode.",
      ok: true,
    },
    {
      id: "aud_0002",
      at: clock.at(-150),
      actor: "agent",
      tool: "create_category",
      argsPreview: "name=Invoices, provenance=from Gmail, last 50 threads, synthetic sample",
      result: "Category Invoices ready.",
      ok: true,
    },
    {
      id: "aud_0003",
      at: clock.at(-95),
      actor: "agent",
      tool: "upsert_dashboard",
      argsPreview: "category=Invoices, kpis=4, charts=3",
      result: "Dashboard for Invoices rendered with 4 KPIs and 3 charts.",
      ok: true,
    },
    {
      id: "aud_0004",
      at: clock.at(-88),
      actor: "agent",
      tool: "compose_overview",
      argsPreview: "title=Work overview, kpis=4, charts=2",
      result: "Overview composed across 4 categories.",
      ok: true,
    },
    {
      id: "aud_0005",
      at: clock.at(-84),
      actor: "agent",
      tool: "register_monitor",
      argsPreview: "name=Invoice watch, schedule=every morning 08:00, runner=local",
      result: "Monitor registered. Held anything over EUR 5,000 and any pay action.",
      ok: true,
    },
    {
      id: "aud_0006",
      at: clock.at(-138),
      actor: "agent",
      tool: "report_monitor_run",
      argsPreview: "monitorId=mon_invoices_demo, findings=2, drafts=2",
      result: "0 auto, 1 pending, 1 held.",
      ok: true,
    },
    {
      id: "aud_0007",
      at: clock.at(-135),
      actor: "agent",
      tool: "approve_draft",
      argsPreview: "draftId=draft_inv_001",
      result: "Refused: clause " + CLAUSE_AMOUNT + ". A human can approve it from the Monitors tab.",
      ok: false,
    },
    {
      id: "aud_0008",
      at: clock.at(-39),
      actor: "system",
      tool: "report_monitor_run",
      argsPreview: "monitorId=mon_tickets_demo, findings=2, drafts=2",
      result: "2 auto, 0 pending, 0 held. Cap is 3 auto actions per run.",
      ok: true,
    },
  ];
}

export function sampleOverview(clock: DemoClock): OverviewSpec {
  return {
    title: "Work overview",
    updatedAt: clock.at(-88),
    kpis: [
      { label: "Categories", value: 4, hint: "Chosen by the agent, not by the page." },
      { label: "Needs a human", value: 4, delta: "2 held, 2 pending" },
      { label: "Money outstanding", value: "EUR 9,120", hint: "Invoices category." },
      { label: "Monitors active", value: 2 },
    ],
    charts: [
      {
        id: "ovw-open-items",
        kind: "bar",
        title: "Open items by category",
        points: [
          { label: "Invoices", value: 6 },
          { label: "Customer tickets", value: 5 },
          { label: "Recruiters", value: 9 },
          { label: "Newsletters", value: 5 },
        ],
      },
      {
        id: "ovw-decisions",
        kind: "donut",
        title: "Draft decisions so far",
        points: [
          { label: "Auto", value: 2 },
          { label: "Pending", value: 2 },
          { label: "Held", value: 2 },
        ],
      },
    ],
    highlights: [
      "Invoice watch held 2 drafts: one over the EUR 5,000 threshold, one because pay requires a human.",
      "Ticket triage auto-labelled 2 tickets and stayed under its cap of 3 per run.",
      "Recruiters and Newsletters have dashboards but no monitor, on purpose.",
    ],
  };
}
