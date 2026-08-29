# Current limitations, and how it gets better

Written 29 Aug 2026 against the shipped build. Honest by design: judges and users should know
where the edges are.

## Where it runs
- WebMCP is young. The page works in the ChatGPT desktop app (Work and Codex, GPT-5.6 Sol or
  Terra) and in Chrome 149+ behind a flag. Nowhere else yet. When more browsers ship the API the
  page needs no change.
- ChatGPT Work quota is finite and resets on a schedule; a long mailbox read can spend it. The
  starter prompt reads 30 threads for that reason; scope up when you have budget.
- A new ChatGPT chat opens a blank side panel: load the page and check the "Site tools on"
  pill before prompting, or the run starts with no tools.

## Turns and coordination
- Turns shipped (docs/TURNS.md): writing claims the object for ten minutes and the card says
  who has it, a write landing on somebody else's fresh change is merged rather than blocked
  (charts by id, KPIs by label, notes appended), and reads hand back an `updatedAt` a write
  can send back as `expectedUpdatedAt`.
- What is still crude: the merge understands the dashboard DSL and nothing else, so a policy
  is one field and a second policy change inside the minute is handed back instead of merged.
  Claim expiry is wall-clock and per browser, so two boards can disagree about who holds a
  card for a few seconds. Nobody is ever blocked by that, which is the point, but it is not a
  lock and must not be sold as one.
- Better: field-level merge for policies too, and claims that survive a reload.

## Identity and rooms
- Rooms are encrypted end to end and the link is the whole credential: anyone holding the
  full link (slug plus the key after the #) can join and edit. No accounts, no roles, no
  kick, no server-side history; a late joiner gets a snapshot only from a live peer that
  actually holds a board. A link with the fragment trimmed off cannot open the room at all,
  which is a common accident with a one-line fix: ask for the whole link.
- The read-only role in an invite is a UI promise, not a permission: both roles carry the
  same key in v1, so a determined holder of a "read" link can still write. Signing keys are
  the fix and they are not in this build.
- The relay is Supabase Realtime broadcast on the free tier (200 concurrent clients, 256 KB per
  message). It forwards patches and stores nothing, which is the privacy promise and also the
  limit.
- Names are self-declared display names stored in the browser.
- Better: accounts and named agents, persistent rooms with roles and history, a relay that
  can be self-hosted (the transport is already isolated behind one interface).

- Observed 29 Aug: a capability card published while a keeper peer held the room was not shown to a browser that joined later ("No capability cards yet"), while categories and notes were. The capability entity likely misses the late-joiner snapshot path; verify src/rooms/snapshot.ts includes `capability` and `pack` kinds.

## What agents can and cannot notice
- An agent only sees the board when it is called. A note left for it waits until someone
  prompts that agent, or until a scheduled task runs it. There is no push to an agent.
- Better: the page tells every agent to call list_feedback at the start of each task (it does),
  and the prompt library ships a "room watcher" scheduled-task prompt so an agent checks its
  requests on a schedule without a human typing.

## Objects and data
- Objects today: categories, dashboards, overview, monitors, drafts, notes, datasets. No
  documents, decks or tools yet; the tool trio (get, upsert, feedback) is designed to extend.
- Boards hold summaries with real names, amounts and dates, never full message bodies. Dropped
  spreadsheets are profiled in the tab and the rows never leave it, which also means a second
  browser cannot query them.
- The board lives in the browser unless shared or in a room; a cleared cache loses it. Download
  board exists for that reason; accounts are the real fix.

## Agent behaviour is not ours to guarantee
- The page enforces its rules (validation, rate limits, policy refusals, audit); it cannot make an
  agent act. A careful model asked to "approve every pending draft" will skip held drafts
  correctly, so prompts must name what they want.
- Better: the prompt library ships exact prompts per feature, and tool results state the next
  call to make.

## Local bridge
- Local bridge: Chrome guards pages that talk to 127.0.0.1 (Local Network Access). The first Connect triggers a permission prompt; headless browsers deny it silently. The page now says so in its error text.

## Operational
- Hosted on Vercel, relay on a shared Supabase project, no paging or metrics beyond Vercel's.
- Better: a health endpoint, relay metrics, and a status line in the About tab.
