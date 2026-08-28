/**
 * The four sample categories of the demo workspace.
 * Everything here is synthetic and obviously so: the companies are named
 * "Acme Test Ltd", "Sample Supplies GmbH", "Example Recruiting" and friends.
 * No real person, employer or client appears anywhere in this file.
 *
 * Shapes respect LIMITS in src/types.ts: at most 4 KPIs, at most 4 charts,
 * at most 12 points per chart, at most 20 table rows.
 */
import type { Category, DashboardSpec, DatasetSummary } from "../types";
import type { DemoClock } from "./clock";

/** One provenance line, repeated on every category, so the board never hides where data came from. */
export const DEMO_PROVENANCE = "from Gmail, last 50 threads, synthetic sample";

const DEMO_SOURCE = "Demo mode: synthetic sample, nothing was read from a real mailbox.";

function category(
  name: string,
  description: string,
  createdAt: string,
  summary: DatasetSummary,
  dashboard: DashboardSpec,
): Category {
  return { name, description, provenance: DEMO_PROVENANCE, createdAt, summary, dashboard };
}

function invoicesSummary(clock: DemoClock): DatasetSummary {
  return {
    counts: { threads: 14, unpaid: 6, overdue: 2, paidThisMonth: 8 },
    sums: { totalEur: 18450, unpaidEur: 9120, overdueEur: 6300 },
    top: {
      suppliers: [
        { label: "Acme Test Ltd", value: 7400 },
        { label: "Sample Supplies GmbH", value: 5200 },
        { label: "Placeholder Logistics BV", value: 3100 },
        { label: "Demo Print Co", value: 2750 },
      ],
    },
    period: "last 30 days",
    rowCount: 14,
    updatedAt: clock.at(-95),
  };
}

function invoicesDashboard(clock: DemoClock): DashboardSpec {
  return {
    category: "Invoices",
    title: "Invoices",
    updatedAt: clock.at(-95),
    source: DEMO_SOURCE,
    kpis: [
      { label: "Open invoices", value: 6, delta: "+2 vs last week", hint: "Unpaid supplier invoices." },
      { label: "Outstanding", value: "EUR 9,120", delta: "+EUR 1,400", hint: "Sum of unpaid amounts." },
      { label: "Overdue", value: 2, hint: "Past the stated payment term." },
      { label: "Average age", value: "11 days", delta: "-3 days" },
    ],
    charts: [
      {
        id: "inv-by-supplier",
        kind: "bar",
        title: "Outstanding by supplier (EUR)",
        points: [
          { label: "Acme Test Ltd", value: 7400 },
          { label: "Sample Supplies GmbH", value: 5200 },
          { label: "Placeholder Logistics BV", value: 3100 },
          { label: "Demo Print Co", value: 2750 },
        ],
        note: "Synthetic amounts.",
      },
      {
        id: "inv-by-week",
        kind: "line",
        title: "Invoice value received per week (EUR)",
        points: [
          { label: "W1", value: 2100 },
          { label: "W2", value: 3400 },
          { label: "W3", value: 2950 },
          { label: "W4", value: 4800 },
          { label: "W5", value: 3200 },
          { label: "W6", value: 2000 },
        ],
      },
      {
        id: "inv-oldest",
        kind: "table",
        title: "Oldest unpaid",
        points: [],
        columns: ["Supplier", "Invoice", "Amount EUR", "Age (days)"],
        rows: [
          ["Acme Test Ltd", "INV-2041", 6300, 27],
          ["Sample Supplies GmbH", "INV-2044", 5200, 14],
          ["Placeholder Logistics BV", "INV-2050", 3100, 9],
          ["Demo Print Co", "INV-2055", 2750, 4],
        ],
      },
    ],
    notes: [
      "Anything over EUR 5,000 is held for a human by the Invoice watch monitor.",
      "Amounts are aggregates: no invoice PDF or line item is stored on the page.",
    ],
  };
}

function recruitersSummary(clock: DemoClock): DatasetSummary {
  return {
    counts: { threads: 12, openRoles: 9, replied: 3, ignored: 6 },
    sums: { medianBandEur: 72000 },
    top: {
      agencies: [
        { label: "Example Recruiting", value: 5 },
        { label: "Sample Talent Partners", value: 4 },
        { label: "Placeholder Search Group", value: 3 },
      ],
    },
    period: "last 30 days",
    rowCount: 12,
    updatedAt: clock.at(-92),
  };
}

function recruitersDashboard(clock: DemoClock): DashboardSpec {
  return {
    category: "Recruiters",
    title: "Recruiters",
    updatedAt: clock.at(-92),
    source: DEMO_SOURCE,
    kpis: [
      { label: "Inbound roles", value: 9, delta: "+4 vs last month" },
      { label: "Replied", value: 3, hint: "Threads where a reply was sent." },
      { label: "Median band", value: "EUR 72k", hint: "Midpoint of the quoted ranges." },
    ],
    charts: [
      {
        id: "rec-seniority",
        kind: "donut",
        title: "Roles by seniority",
        points: [
          { label: "Senior", value: 5 },
          { label: "Mid", value: 3 },
          { label: "Lead", value: 1 },
        ],
      },
      {
        id: "rec-agency",
        kind: "bar",
        title: "Threads by agency",
        points: [
          { label: "Example Recruiting", value: 5 },
          { label: "Sample Talent Partners", value: 4 },
          { label: "Placeholder Search Group", value: 3 },
        ],
      },
    ],
    notes: ["No monitor is attached: this category is read-only in the sample."],
  };
}

function ticketsSummary(clock: DemoClock): DatasetSummary {
  return {
    counts: { threads: 17, open: 5, closed: 12, slaBreached: 1, reopened: 2 },
    sums: { firstResponseMinutes: 190 },
    top: {
      topics: [
        { label: "Billing", value: 6 },
        { label: "Login", value: 5 },
        { label: "Export", value: 4 },
        { label: "Other", value: 2 },
      ],
    },
    period: "last 14 days",
    rowCount: 17,
    updatedAt: clock.at(-45),
  };
}

function ticketsDashboard(clock: DemoClock): DashboardSpec {
  return {
    category: "Customer tickets",
    title: "Customer tickets",
    updatedAt: clock.at(-45),
    source: DEMO_SOURCE,
    kpis: [
      { label: "Open tickets", value: 5, delta: "-1 today" },
      { label: "First response", value: "3h 10m", delta: "-40m", hint: "Median across the sample." },
      { label: "SLA breaches", value: 1, hint: "One thread passed 24h without a reply." },
      { label: "Reopened", value: 2 },
    ],
    charts: [
      {
        id: "tick-per-day",
        kind: "line",
        title: "Tickets opened per day",
        points: [
          { label: "Mon", value: 3 },
          { label: "Tue", value: 2 },
          { label: "Wed", value: 4 },
          { label: "Thu", value: 1 },
          { label: "Fri", value: 3 },
          { label: "Sat", value: 2 },
          { label: "Sun", value: 2 },
        ],
      },
      {
        id: "tick-topic",
        kind: "donut",
        title: "Tickets by topic",
        points: [
          { label: "Billing", value: 6 },
          { label: "Login", value: 5 },
          { label: "Export", value: 4 },
          { label: "Other", value: 2 },
        ],
      },
      {
        id: "tick-waiting",
        kind: "table",
        title: "Waiting longest",
        points: [],
        columns: ["Customer", "Topic", "Waiting (hours)"],
        rows: [
          ["Acme Test Ltd", "Billing", 26],
          ["Example Retail NV", "Export", 11],
          ["Sample Supplies GmbH", "Login", 7],
        ],
      },
    ],
    notes: ["The Ticket triage monitor may auto-label at most 3 tickets per run."],
  };
}

function newslettersSummary(clock: DemoClock): DatasetSummary {
  return {
    counts: { threads: 7, unread: 5, read: 2 },
    top: {
      senders: [
        { label: "Sample Weekly", value: 3 },
        { label: "Example Product Digest", value: 2 },
        { label: "Placeholder Dev News", value: 1 },
        { label: "Demo Market Brief", value: 1 },
      ],
    },
    period: "last 30 days",
    rowCount: 7,
    updatedAt: clock.at(-90),
  };
}

function newslettersDashboard(clock: DemoClock): DashboardSpec {
  return {
    category: "Newsletters",
    title: "Newsletters",
    updatedAt: clock.at(-90),
    source: DEMO_SOURCE,
    kpis: [
      { label: "Subscriptions", value: 7 },
      { label: "Unread", value: 5, delta: "+2" },
      { label: "Read rate", value: "29%", hint: "Read divided by received." },
    ],
    charts: [
      {
        id: "news-senders",
        kind: "bar",
        title: "Issues by sender",
        points: [
          { label: "Sample Weekly", value: 3 },
          { label: "Example Product Digest", value: 2 },
          { label: "Placeholder Dev News", value: 1 },
          { label: "Demo Market Brief", value: 1 },
        ],
      },
      {
        id: "news-read",
        kind: "donut",
        title: "Read versus unread",
        points: [
          { label: "Unread", value: 5 },
          { label: "Read", value: 2 },
        ],
      },
    ],
    notes: ["Low-value category: kept so the overview has something to rank last."],
  };
}

/** All four sample categories, keyed by name exactly as the tools key them. */
export function sampleCategories(clock: DemoClock): Readonly<Record<string, Category>> {
  const list: readonly Category[] = [
    category(
      "Invoices",
      "Supplier invoices and payment requests found in the mailbox.",
      clock.at(-150),
      invoicesSummary(clock),
      invoicesDashboard(clock),
    ),
    category(
      "Recruiters",
      "Agency outreach about open roles.",
      clock.at(-148),
      recruitersSummary(clock),
      recruitersDashboard(clock),
    ),
    category(
      "Customer tickets",
      "Support threads from customers, grouped by topic.",
      clock.at(-146),
      ticketsSummary(clock),
      ticketsDashboard(clock),
    ),
    category(
      "Newsletters",
      "Subscription mail, mostly unread.",
      clock.at(-144),
      newslettersSummary(clock),
      newslettersDashboard(clock),
    ),
  ];
  return Object.freeze(
    list.reduce<Record<string, Category>>((acc, item) => ({ ...acc, [item.name]: item }), {}),
  );
}
