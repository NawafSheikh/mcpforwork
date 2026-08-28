/**
 * Sample feedback: the turn-taking half of the demo board.
 *
 * Two open notes a human left on dashboards, one note the agent has already resolved with
 * a resolution line, and one note on a held draft. All synthetic, like the rest of the
 * sample: no real supplier, customer or person appears here.
 */
import type { Feedback } from "../types";
import type { DemoClock } from "./clock";

export const DEMO_FEEDBACK_INVOICES = "fb_invoices_ageing";
export const DEMO_FEEDBACK_TICKETS = "fb_tickets_topics";
export const DEMO_FEEDBACK_OVERVIEW = "fb_overview_resolved";
export const DEMO_FEEDBACK_DRAFT = "fb_draft_acme_hold";

export function sampleFeedback(clock: DemoClock): Readonly<Record<string, Feedback>> {
  const list: readonly Feedback[] = [
    {
      id: DEMO_FEEDBACK_INVOICES,
      target: { kind: "dashboard", id: "Invoices" },
      text: "Split the outstanding bar by ageing bucket: under 30 days, 30 to 60, over 60. One number for everything overdue hides the only part I act on.",
      author: "human",
      createdAt: clock.at(-95),
    },
    {
      id: DEMO_FEEDBACK_TICKETS,
      target: { kind: "dashboard", id: "Customer tickets" },
      text: "Top topics are too coarse. Keep Billing, but break Delivery into late and damaged before the next run.",
      author: "human",
      createdAt: clock.at(-74),
    },
    {
      id: DEMO_FEEDBACK_OVERVIEW,
      target: { kind: "overview", id: "overview" },
      text: "The overview leads with thread counts, which is not the thing I look at first. Lead with money at risk.",
      author: "human",
      createdAt: clock.at(-60),
      resolvedAt: clock.at(-41),
      resolvedBy: "agent",
      resolution:
        "Rebuilt the overview with EUR 9,120 outstanding as the first KPI and moved thread volume to the third slot. Category chart unchanged.",
    },
    {
      id: DEMO_FEEDBACK_DRAFT,
      target: { kind: "draft", id: "draft_inv_001" },
      text: "Do not re-propose this one until Acme Test Ltd sends the proof of delivery. Held is correct.",
      author: "human",
      createdAt: clock.at(-30),
    },
  ];
  return Object.freeze(
    list.reduce<Record<string, Feedback>>((acc, item) => ({ ...acc, [item.id]: item }), {}),
  );
}
