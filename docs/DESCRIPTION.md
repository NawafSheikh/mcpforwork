# MCP for Work

Your work becomes agent-ready: your own ChatGPT is the analyst and the local runner; this
page is the board and the guardrails.

## Why WebMCP fits this use case

Building a dashboard over your work mail is a data problem, not a rendering problem. The
hard parts are reading the threads, deciding the categories and computing the aggregates.
Products that do this pay a model per user and need your mailbox.

WebMCP removes both. ChatGPT already holds the connectors and the reasoning; it needs a
typed place to put the answer, not a copy of your data in someone else's database. So the
page ships no model and no inbox integration: eighteen tools, a policy engine and a
renderer. It never sees a raw record. The tools accept counts, sums, top-N lists and chart
points, never rows: a property of the protocol, not a promise.

It held up on real data. On 28 August 2026 one ChatGPT desktop conversation read 50 Gmail
threads and wrote six dashboards and an overview onto this page. Before writing, it asked:
"May I now transmit the de-identified category counts, generic topic labels, dates, and
attention states to mcpforwork.com? It will not receive your email address, sender names,
subjects, URLs, IDs, snippets, or message bodies."

## How it improves the user experience

You talk, the board builds. One prompt produces a category per theme, a dashboard for
each, and an overview on top, every card carrying its provenance line.

Then it keeps working while you do not. "Register a monitor on the Invoices category every
morning at 08:00 that holds anything over EUR 5,000 and always asks a human before pay"
registers the monitor and hands back the prompt for the matching scheduled task, which the
real run created in ChatGPT, daily at 08:00.

Corrections stay in the loop: leave a note on a dashboard and it stays open until an agent
reads it back, acts, and closes it with a resolution. Every call can carry a caller label,
so when ChatGPT splits work between sub-agents the rail shows which one wrote what: the
real run labelled its halves "Classify 1 25" and "Classify 26 50". Press Share and the
whole board travels in a URL fragment, read only, with no backend behind it.

## What people and agents can do together that was not possible before

The agent supervises its own background work under a rule the human wrote, and is
overruled by it. Asked to approve every pending draft, it was refused twice, each refusal
naming its own clause: the EUR 7,200 invoice exceeds EUR 5,000, and every pay action
requires a human. Approved drafts: zero. The refusal is not an instruction the model may
choose to follow; it is a function that returns false.

That asymmetry is new. Before WebMCP the agent either had your credentials and could do
anything, or had nothing and could only advise. Here it gets a narrow typed surface, a cap
on unattended actions per run, and a veto it cannot argue with, while the human keeps a
board that stays readable with no agent present.

## How WebMCP was implemented

Eighteen tools registered once from the top-level page via `document.modelContext`
(falling back to `navigator.modelContext`). Tabs are React state, never navigation, so the
tool set survives the conversation. A shared snapshot registers nothing at all.

Annotations: read tools set `readOnlyHint`; tools echoing text from the user's own data,
or from another human, set `untrustedContentHint`.

Validation: every input passes zod at the boundary with hard limits (4 KPIs, 4 charts, 12
points, 20 rows, 1500-character results, 60 calls a minute).

Audit: every call writes actor, caller, tool, argument preview and result to an on-screen
rail.

Policy engine: each drafted action is auto, pending, or held with a clause, decided by
thresholds, allowlist, denylist, `requireHumanFor` and a per-run cap. `approve_draft`
re-runs the same check.
