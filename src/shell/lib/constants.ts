/** Shell copy and constants. Owner A9 in wave 2. */

/**
 * The starter prompt, scoped for a live demo. The 28 Aug end to end run against real
 * Gmail took about 30 minutes because it read 50 full threads; headers only over 30
 * threads gets the same board in a fraction of the time.
 */
export const STARTER_PROMPT =
  "Read the subject, sender and date of my last 30 Gmail threads (no bodies), group them " +
  "into 4 to 6 categories, and on this page call create_category, upsert_dataset_summary " +
  "and upsert_dashboard for each, then compose_overview. Pass caller on every call.";

/** The same shape, small enough to finish while a judge is watching. */
export const QUICK_PROMPT =
  "Read the subject, sender and date of my last 15 Gmail threads (no bodies), group them " +
  "into 3 or 4 categories, and on this page call create_category and upsert_dashboard for " +
  "each, then compose_overview. Pass caller on every call.";

/** Registers the guardrail and exercises it in the same turn. */
export const MONITOR_PROMPT =
  "Register a monitor on the Invoices category every morning at 08:00 that holds anything " +
  "over EUR 5,000 and always asks a human before pay, then run it once now and report back " +
  "with report_monitor_run.";

export const SHARE_BANNER =
  "Shared snapshot. Open mcpforwork.com in ChatGPT desktop to work on your own board.";

export const WEBMCP_UNAVAILABLE_TEXT =
  "WebMCP not available in this browser: open in ChatGPT desktop or Chrome 149+ with the flag";

export interface Step {
  readonly title: string;
  readonly body: string;
}

export const BOARD_STEPS: readonly Step[] = [
  {
    title: "1. Paste the prompt",
    body: "Open this page inside the ChatGPT desktop built-in browser and paste the starter prompt. ChatGPT reads your mail, files or tickets through its own connectors.",
  },
  {
    title: "2. Watch the board fill",
    body: "ChatGPT creates a category per theme and calls the site tools on this page to build one dashboard for each, then composes an overview on top. Only aggregates cross the boundary.",
  },
  {
    title: "3. Set the guardrails",
    body: "Register monitors that report back on a schedule, write the policy that decides what runs on its own, and keep the approve button for yourself.",
  },
];

/**
 * The path to the built-in browser, as measured in ChatGPT desktop on 28 Aug 2026.
 * It is not discoverable, which is why it is written down here and in the About tab.
 */
export const CHATGPT_STEPS: readonly string[] = [
  "Top left, the mode switcher: choose ChatGPT, not Codex.",
  "Top centre, the Chat and Work toggle: choose Work.",
  "Top right, the Toggle side panel button: that is the built-in browser.",
  "Paste https://mcpforwork.com into the side panel address bar.",
  "Use GPT-5.6 Sol or Terra. Site tools then appears in the address bar, left of the domain.",
];

/** The sidebar trap, worth one line because it costs everyone five minutes. */
export const CHATGPT_STEPS_NOTE =
  "The sidebar entry named Sites is a website builder, not the browser. Dismiss the first load overlays or they cover the Site tools icon.";

/** Kept as the name the About tab and any older importer already use. */
export const SETUP_STEPS: readonly string[] = CHATGPT_STEPS;

export const TAB_IDS = ["board", "monitors", "activity", "about"] as const;
export type TabId = (typeof TAB_IDS)[number];

export const TAB_LABELS: Readonly<Record<TabId, string>> = {
  board: "Board",
  monitors: "Monitors",
  activity: "Activity",
  about: "About",
};

export const RAIL_EVENT_COUNT = 8;
