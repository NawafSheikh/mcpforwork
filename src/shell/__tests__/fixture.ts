/**
 * A board with something on it, built here rather than shipped.
 *
 * The app has no sample data of its own any more: an empty board is empty until an agent
 * fills it. The render tests still need a filled board to look at, so they build one,
 * and it never reaches the bundle.
 */
import { emptyWorkspace } from "../../store";
import { makeAuditEvent } from "../../store/audit";
import type { Category, DraftAction, Monitor, MonitorRun, Workspace } from "../../types";

export const AT = "2026-08-29T09:00:00.000Z";

function category(name: string, rows: number): Category {
  return {
    name,
    createdAt: AT,
    summary: { rowCount: rows, updatedAt: AT },
    dashboard: {
      category: name,
      title: `${name} dashboard`,
      kpis: [{ label: "Open", value: rows }],
      charts: [
        {
          id: `${name}-by-supplier`,
          kind: "bar",
          title: "By supplier",
          points: [
            { label: "First", value: 3 },
            { label: "Second", value: 2 },
          ],
        },
      ],
      updatedAt: AT,
    },
  };
}

const MONITOR: Monitor = {
  id: "mon_invoices",
  name: "Invoice watch",
  category: "Invoices",
  schedule: "every morning 08:00",
  policy: {
    maxAutoActionsPerRun: 2,
    thresholds: [{ field: "amount", op: "gt", value: 5000 }],
    requireHumanFor: ["pay"],
  },
  runner: "local",
  status: "active",
  createdAt: AT,
  nextRunAt: AT,
};

const RUN: MonitorRun = {
  id: "run_invoices_1",
  monitorId: MONITOR.id,
  runner: "local",
  startedAt: AT,
  finishedAt: AT,
  findings: ["Two invoices over the threshold"],
  draftIds: ["draft_held", "draft_auto"],
};

const HELD: DraftAction = {
  id: "draft_held",
  monitorId: MONITOR.id,
  runId: RUN.id,
  kind: "pay",
  target: "ACME invoice",
  summary: "Pay EUR 6,300",
  amount: 6300,
  status: "held",
  heldReason: "threshold:amount>5000",
};

const AUTO: DraftAction = {
  id: "draft_auto",
  monitorId: MONITOR.id,
  runId: RUN.id,
  kind: "tag",
  target: "Invoice 44",
  summary: "Tag as reviewed",
  status: "auto",
};

/** Two categories with dashboards, an overview, a monitor, a run and a held draft. */
export function filledBoard(): Workspace {
  const base = emptyWorkspace("local", AT);
  return {
    ...base,
    categories: { Invoices: category("Invoices", 30), Tickets: category("Tickets", 10) },
    overview: {
      title: "Where the work is",
      kpis: [{ label: "Categories", value: 2 }],
      charts: [
        {
          id: "overview-share",
          kind: "donut",
          title: "Share of board",
          points: [
            { label: "Invoices", value: 30 },
            { label: "Tickets", value: 10 },
          ],
        },
      ],
      updatedAt: AT,
    },
    monitors: { [MONITOR.id]: MONITOR },
    runs: [RUN],
    drafts: { [HELD.id]: HELD, [AUTO.id]: AUTO },
    audit: [
      makeAuditEvent({
        actor: "agent",
        caller: "ChatGPT",
        tool: "upsert_dashboard",
        args: { category: "Invoices" },
        ok: true,
      }),
    ],
  };
}
