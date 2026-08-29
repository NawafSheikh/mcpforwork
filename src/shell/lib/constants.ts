/** Shell copy and constants. Owner A9 in wave 2. */

/**
 * The starter prompt, scoped for a live demo. The 28 Aug end to end run against real
 * Gmail took about 30 minutes because it read 50 full threads; headers only over 30
 * threads gets the same board in a fraction of the time.
 */
export const STARTER_PROMPT =
  "Read my last 30 Gmail threads, group them " +
  "into 4 to 6 categories, and on this page call create_category, upsert_dataset_summary " +
  "and upsert_dashboard for each, then compose_overview. Use the real sender names, subjects, suppliers, amounts and dates as labels and notes; only the full message bodies stay in Gmail. Pass caller on every call.";

/** The same shape, small enough to finish while a judge is watching. */
export const QUICK_PROMPT =
  "Read my last 15 Gmail threads, group them " +
  "into 3 or 4 categories, and on this page call create_category and upsert_dashboard for " +
  "each, then compose_overview. Use the real sender names, subjects, suppliers, amounts and dates as labels and notes; only the full message bodies stay in Gmail. Pass caller on every call.";

/**
 * The prompt that uses the most of ChatGPT in one run: its connectors to read the source,
 * its sub-agents to read three areas at once, and a workspace per area so the second job
 * does not land on top of the first. This is what the page is for, in one paste.
 */
export const PROJECTS_PROMPT =
  "Do not put everything on one board. First call list_workspaces to see what is already here. " +
  "Then read my last 40 Gmail threads, decide the 3 areas of work they are really about, and for each area: " +
  "call create_workspace with the name a person would use and a line on what belongs in it, run a sub-agent " +
  "over just that area's threads, and from what it finds call create_category, upsert_dataset_summary and " +
  "upsert_dashboard per theme, then compose_overview. Finish each area with save_workspace and a note saying " +
  "what it holds. Pass caller on every call so I can see which sub-agent did what, and tell me at the end " +
  "what is in each workspace.";

/** Offered once a board is done and nothing is waiting: start the next one beside it. */
export const NEXT_PROJECT_PROMPT =
  "This board is done. Call create_workspace for the next thing I am working on, named after it, then fill it " +
  "from your connectors: create_category and upsert_dashboard per theme, compose_overview on top, and " +
  "save_workspace with a line on what it holds. Leave this board exactly as it is.";

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

/** How many events the live feed keeps on screen. */
export const RAIL_EVENT_COUNT = 40;

/* ---------- the room line in the top bar ---------- */

export const LOCAL_BOARD_LABEL = "Local · this browser only";
export const LOCAL_BOARD_NOTE =
  "This board lives in this browser. Invite somebody and it becomes an encrypted room.";

/**
 * A room link with no key after the # is a public room, not a broken one: it is the one
 * kind of room this build leaves unencrypted, so a stranger can open a link somebody
 * posted and start working. Every room minted through Invite carries a key and is
 * unlisted.
 */
export const PUBLIC_ROOM_LABEL = "Public room";
export const PUBLIC_ROOM_NOTE =
  "Anyone with the link can read and edit. Nothing here is private.";

/** Shown in the centre when this browser holds a key that does not open the room. */
export const WRONG_KEY_MESSAGE =
  "This link's key does not open this room. Ask the person who invited you for the full link.";

/** How long the page waits for something readable before it says the key is wrong. */
export const WRONG_KEY_MS = 10_000;

/* ---------- the first run ---------- */

/** The address a visitor pastes into the ChatGPT desktop side panel. */
export const SITE_HOST = "mcpforwork.com";

/** The id on the landing name field, so the next step card can focus it. */
export const NAME_INPUT_ID = "mfw-your-name";

export const NAME_QUESTION = "What should we call you?";
export const NAME_PLACEHOLDER = "Your name";
export const NAME_UNSET_CHIP = "Set your name";
/** What the members rail calls this browser before anybody typed a name. */
export const YOU = "You";

export const AGENT_HEADING = "Your agent";
export const AGENT_OFF = "Not connected. Your ChatGPT joins when this page runs inside it.";
export const AGENT_ON = "ChatGPT is in the room";
export const AGENT_ROW_ON = "ChatGPT";
export const AGENT_ROW_OFF = "not connected";

export const CONTROLS_HEADING = "What you control";

/* ---------- phone layout ---------- */

export const PHONE_PANES = ["board", "requests", "live", "people"] as const;
export type PhonePane = (typeof PHONE_PANES)[number];

export const PHONE_LABELS: Readonly<Record<PhonePane, string>> = {
  board: "Board",
  requests: "Requests",
  live: "Live",
  people: "People",
};

/** Names the held items on purpose: an agent asked for "pending" will correctly skip held drafts. */
export const APPROVE_ALL_PROMPT =
  "Approve every draft on this page, including the ones marked held. Call approve_draft for each one and tell me which were refused and why.";
