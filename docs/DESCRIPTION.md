# MCP for Work

Your work becomes agent-ready: your own ChatGPT is the analyst and the local runner; this
page is the board and the guardrails.

## Why WebMCP fits this use case

Building a dashboard over your work mail is a data problem, not a rendering problem. The
hard parts are reading fifty threads, deciding the categories and computing the
aggregates. Products that do this pay a model per user and need your mailbox.

WebMCP removes both. ChatGPT already holds the connectors and the reasoning; it needs a
typed place to put the answer, not a copy of your data in someone else's database. So the
page ships no model, no scraper and no inbox integration: fifteen tools, a policy engine
and a renderer. It never sees a raw record, because the tools accept counts, sums, top-N
lists and chart points, never rows. That privacy property falls out of the protocol
instead of being promised in a policy page.

Background work follows the same shape. A monitor is a schedule plus a policy: the
schedule runs as a ChatGPT desktop scheduled task on the user's own machine, the policy
lives on the page where the user can read it.

## How it improves the user experience

You talk, the board builds. "Read my last fifty Gmail threads, group them into categories
and build a dashboard for each one" produces four categories, four dashboards and an
overview, each card carrying its provenance line. No field mapping, no chart picker.

Then it keeps working while you do not. "Watch Invoices every morning and hold anything
over EUR 5,000 for me" registers a monitor and hands back the prompt for the matching
scheduled task. Next morning the run log has filled in, and anything over the threshold
sits in the Monitors tab, held, with the clause that held it.

Nothing costs the operator per user, so demo mode needs no account and no backend: press
one button and the board is finished.

## What people and agents can do together that was not possible before

The agent can supervise its own background work under a rule the human wrote, and be
overruled by it. Ask ChatGPT to approve a held draft and it is refused, by name:
`Refused: clause threshold:amount>5000`. The refusal is not a prompt instruction the model
may choose to follow; it is a function that returns false. The human then approves the
same draft in one click, audited as actor `human` rather than `agent`.

That asymmetry is new. Before WebMCP the agent either had your credentials and could do
anything, or had nothing and could only advise. Here it gets a narrow typed surface, a cap
on unattended actions per run, and a veto it cannot argue with, while the human keeps a
board that stays readable with no agent present.

## How WebMCP was implemented

Fifteen tools registered once from the top-level page via `document.modelContext`
(falling back to `navigator.modelContext`). Tabs are React state, never navigation, so the
tool set survives the conversation.

Annotations: read tools set `readOnlyHint`; tools echoing text derived from the user's own
data set `untrustedContentHint`, so a client treats an email subject as data.

Validation: every input passes zod at the boundary with hard limits (4 KPIs, 4 charts, 12
points, 20 rows, 500-character descriptions, 1500-character results, 60 calls a minute).

Audit: every call writes actor, tool, argument preview and result to an on-screen rail.

Policy engine: each drafted action is auto, pending, or held with a clause, decided by
thresholds, allowlist, denylist, `requireHumanFor` and a per-run cap. `approve_draft`
re-runs the identical check.
