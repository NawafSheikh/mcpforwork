/** Shell copy and constants. Owner A4. */

export const STARTER_PROMPT =
  "Look at my last 50 Gmail threads, group them into categories, and build a dashboard for each one on this page, then compose an overview.";

export const WEBMCP_UNAVAILABLE_TEXT =
  "WebMCP not available in this browser: open in ChatGPT desktop or Chrome 149+ with the flag";

export interface Step {
  readonly title: string;
  readonly body: string;
}

export const BOARD_STEPS: readonly Step[] = [
  {
    title: "1. Paste the prompt",
    body: "Open this page inside ChatGPT desktop and paste the starter prompt. ChatGPT reads your mail, files or tickets through its own connectors.",
  },
  {
    title: "2. Watch the board fill",
    body: "ChatGPT creates a category per theme and calls the site tools on this page to build one dashboard for each, then composes an overview on top.",
  },
  {
    title: "3. Set the guardrails",
    body: "Register monitors that report back on a schedule, write the policy that decides what runs on its own, and keep the approve button for yourself.",
  },
];

export const SETUP_STEPS: readonly string[] = [
  "Use GPT-5.6 Sol or Terra, the models that can drive site tools.",
  "Open mcpforwork.com in the ChatGPT built-in browser, not a separate window.",
  "Turn on Site tools for this page, then paste the starter prompt.",
];

export const TAB_IDS = ["board", "monitors", "activity", "about"] as const;
export type TabId = (typeof TAB_IDS)[number];

export const TAB_LABELS: Readonly<Record<TabId, string>> = {
  board: "Board",
  monitors: "Monitors",
  activity: "Activity",
  about: "About",
};

export const RAIL_EVENT_COUNT = 8;
