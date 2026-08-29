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
- Today there are no turns: everyone writes, last writer wins per object, and the audit rail
  tells you afterwards. Fine for a demo, wrong for a team.
- Fix in progress (docs/TURNS.md): claims with expiry ("Maria's agent is working on Invoices"),
  addressed requests as the handoff, version-checked writes that refuse to overwrite something
  that changed since the agent last read it, and humans outranking agents on claims.

## Identity and rooms
- Rooms are unlisted links: anyone with the link can join and edit. No accounts, no roles, no
  kick, no server-side history; a late joiner gets a snapshot only from a live peer.
- The relay is Supabase Realtime broadcast on the free tier (200 concurrent clients, 256 KB per
  message). It forwards patches and stores nothing, which is the privacy promise and also the
  limit.
- Names are self-declared display names stored in the browser.
- Better: accounts and named agents, persistent rooms with roles and history, a relay that
  can be self-hosted (the transport is already isolated behind one interface).

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

## Operational
- Hosted on Vercel, relay on a shared Supabase project, no paging or metrics beyond Vercel's.
- Better: a health endpoint, relay metrics, and a status line in the About tab.
