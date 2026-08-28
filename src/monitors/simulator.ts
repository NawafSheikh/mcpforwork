/**
 * Demo-mode runner. Produces obviously synthetic findings and drafts for a
 * monitor, then pushes them down the same policy path report_monitor_run uses,
 * so the board a visitor sees is produced by the real engine.
 * Every company, ticket and document name here is fictional test data.
 */

import { fnv1a64 } from "../../packages/hash/src/index";
import type { DraftCandidate } from "../policy/engine";
import type { Monitor, Workspace, WorkspaceStore } from "../types";
import { applyRun } from "./runCore";

export interface Scenario {
  readonly findings: readonly string[];
  readonly drafts: readonly DraftCandidate[];
}

const COMPANIES = [
  "Acme Test Ltd",
  "Globex Demo BV",
  "Initech Sample GmbH",
  "Umbrella Sandbox SA",
  "Wayne Fixtures Ltd",
] as const;

type Random = () => number;

function seededRandom(seed: string): Random {
  const start = Number(BigInt(`0x${fnv1a64(seed)}`) & 0xffffffffn);
  let state = start >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function pick<T>(random: Random, values: readonly T[], fallback: T): T {
  return values[Math.floor(random() * values.length)] ?? fallback;
}

function money(random: Random, low: number, high: number): number {
  return Math.round((low + random() * (high - low)) / 50) * 50;
}

function reference(random: Random, prefix: string): string {
  return `${prefix}-${1000 + Math.floor(random() * 8999)}`;
}

function invoiceScenario(random: Random): Scenario {
  const big = money(random, 6000, 24000);
  const small = money(random, 200, 3200);
  const supplier = pick(random, COMPANIES, "Acme Test Ltd");
  const other = pick(random, COMPANIES, "Globex Demo BV");
  const bigRef = reference(random, "INV");
  return {
    findings: [
      `${2 + Math.floor(random() * 4)} new invoices landed since the last run.`,
      `Largest is ${bigRef} from ${supplier} at ${big}.`,
      "Two invoices are missing a purchase order reference.",
    ],
    drafts: [
      { kind: "flag_invoice", target: bigRef, summary: `Flag ${bigRef} from ${supplier} for a second look`, amount: big, fields: { supplier } },
      { kind: "notify_owner", target: "finance owner", summary: "Tell the finance owner which invoices need a purchase order", fields: { channel: "digest" } },
      { kind: "schedule_payment", target: reference(random, "INV"), summary: `Schedule payment for a small invoice from ${other}`, amount: small },
      { kind: "tag_record", target: bigRef, summary: "Tag the invoice as awaiting a purchase order", fields: { tag: "missing-po" } },
      { kind: "send_payment", target: supplier, summary: `Release the held payment run for ${supplier}`, amount: big },
    ],
  };
}

function supplierScenario(random: Random): Scenario {
  const primary = pick(random, COMPANIES, "Acme Test Ltd");
  const duplicate = `${primary.toUpperCase()} (DUP)`;
  return {
    findings: [
      `Two supplier records look like the same company: ${primary} and ${duplicate}.`,
      `${1 + Math.floor(random() * 3)} suppliers have no bank details on file.`,
    ],
    drafts: [
      { kind: "merge_supplier", target: `${primary} / ${duplicate}`, summary: `Merge the duplicate record for ${primary}`, fields: { confidence: "0.92" } },
      { kind: "tag_record", target: duplicate, summary: "Tag the duplicate as pending verification", fields: { tag: "duplicate" } },
      { kind: "notify_owner", target: "procurement owner", summary: "Ask procurement to confirm the merge", fields: { channel: "digest" } },
      { kind: "update_bank_details", target: primary, summary: `Update the bank details on file for ${primary}`, amount: 0 },
    ],
  };
}

function ticketScenario(random: Random): Scenario {
  const stale = reference(random, "TCK");
  const days = 6 + Math.floor(random() * 9);
  return {
    findings: [
      `${stale} has been idle for ${days} days.`,
      `${1 + Math.floor(random() * 4)} tickets are past their response target.`,
      "No ticket is missing an owner.",
    ],
    drafts: [
      { kind: "nudge_owner", target: stale, summary: `Nudge the owner of ${stale}, idle ${days} days`, fields: { idleDays: days } },
      { kind: "escalate_ticket", target: reference(random, "TCK"), summary: "Escalate a ticket that passed its response target", fields: { idleDays: days } },
      { kind: "tag_record", target: stale, summary: "Tag the stale ticket for the weekly review", fields: { tag: "stale" } },
      { kind: "close_ticket", target: reference(random, "TCK"), summary: "Close a ticket the reporter confirmed as resolved" },
    ],
  };
}

function newsletterScenario(random: Random): Scenario {
  const spike = 300 + Math.floor(random() * 1500);
  const source = pick(random, ["a partner post", "an event page", "a demo signup form"], "a partner post");
  return {
    findings: [
      `Signups jumped by ${spike} this week, mostly from ${source}.`,
      "Unsubscribes stayed flat.",
    ],
    drafts: [
      { kind: "tag_campaign", target: "August digest", summary: `Tag the digest with the ${spike} signup spike`, fields: { signups: spike } },
      { kind: "notify_owner", target: "growth owner", summary: `Tell the growth owner where the ${spike} signups came from` },
      { kind: "send_broadcast", target: "new subscriber segment", summary: `Send a welcome broadcast to ${spike} new subscribers`, amount: spike },
      { kind: "tag_record", target: source, summary: "Tag the referring source for attribution" },
    ],
  };
}

const SCENARIOS: readonly (readonly [RegExp, (random: Random) => Scenario])[] = [
  [/invoice|billing|payable|finance|spend/i, invoiceScenario],
  [/supplier|vendor|procure|master ?data/i, supplierScenario],
  [/ticket|support|helpdesk|issue|sla/i, ticketScenario],
  [/news|subscri|marketing|campaign|growth|email/i, newsletterScenario],
];

function scenarioFor(monitor: Monitor, random: Random): Scenario {
  const haystack = `${monitor.category} ${monitor.name}`;
  const match = SCENARIOS.find(([pattern]) => pattern.test(haystack));
  return match ? match[1](random) : ticketScenario(random);
}

/** Produce 2 to 5 synthetic drafts and run them through the policy engine. */
export function simulateRun(
  ws: Workspace,
  monitorId: string,
  now: Date,
): Workspace {
  const monitor = ws.monitors[monitorId];
  if (!monitor) {
    return ws;
  }
  const random = seededRandom(`${monitorId}|${now.toISOString()}`);
  const scenario = scenarioFor(monitor, random);
  const take = Math.min(
    scenario.drafts.length,
    2 + Math.floor(random() * 4),
  );
  return applyRun(
    ws,
    monitor,
    scenario.findings,
    scenario.drafts.slice(0, take),
    now,
  ).next;
}

export interface DemoSchedulerOptions {
  readonly tickMs: number;
  /** Called instead of swallowing a failed run, so nothing fails silently. */
  readonly onError?: (error: unknown) => void;
}

function dueMonitors(ws: Workspace, now: Date): readonly Monitor[] {
  if (ws.mode !== "demo") {
    return [];
  }
  return Object.values(ws.monitors).filter(
    (monitor) =>
      monitor.status === "active" &&
      monitor.nextRunAt !== undefined &&
      new Date(monitor.nextRunAt).getTime() <= now.getTime(),
  );
}

/** Fire simulateRun for every demo monitor whose nextRunAt has passed. */
export function startDemoScheduler(
  store: WorkspaceStore,
  options: DemoSchedulerOptions,
): () => void {
  let busy = false;

  const tick = async (): Promise<void> => {
    if (busy) {
      return;
    }
    busy = true;
    try {
      const now = new Date();
      for (const monitor of dueMonitors(store.get(), now)) {
        await store.update((current) => simulateRun(current, monitor.id, now));
      }
    } catch (error) {
      options.onError?.(error);
    } finally {
      busy = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, Math.max(options.tickMs, 250));

  return () => clearInterval(timer);
}
