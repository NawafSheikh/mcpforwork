# Video script: MCP for Work

**Target length: 2 minutes 40 seconds.** Screen recording of ChatGPT desktop with the
built-in browser open on the console, voiceover recorded separately and cut to the shots.

Rules for the recording:

- One take of the real product. No mock-ups, no sped-up fake typing.
- Sign in to nothing on camera. The whole video runs in demo mode plus one real agent
  conversation, so nothing personal appears.
- Every mailbox screen shown is the synthetic sample: Acme Test Ltd, Sample Supplies GmbH,
  Example Recruiting. Say the word "synthetic" out loud once, early.
- Model must be GPT-5.6 Sol or Terra. Show the model picker for half a second in shot 1 so
  a judge can verify it.
- Keep the cursor still while a tool call is running. The tool-call chips are the proof.

Timings are cumulative. Total spoken words: roughly 380, which is a comfortable pace for
2:40 with the pauses noted below.

---

## Shot 1: the claim (0:00 to 0:15)

**On screen.** The console at rest in the ChatGPT desktop built-in browser. Empty board.
Zoom the address bar so the Site tools indicator and the tool count are legible, then the
status pill in the page header reading the same count.

**Spoken.**
"This page has no AI in it. It never reads my mail, and it never calls a model. It just
exposes fifteen typed tools. The intelligence comes from my own ChatGPT, which is already
sitting right here."

---

## Shot 2: the connector pull (0:15 to 0:40)

**On screen.** Type the prompt into ChatGPT. Let the Gmail connector chip appear, then the
first `create_category` tool-call chip. Do not cut away while it works.

**Prompt typed on camera.**
"Read my last fifty Gmail threads, group them into categories, and build a dashboard for
each one on this page."

**Spoken.**
"One sentence. It uses its own Gmail connector to read the threads, on its side, and then
it starts calling the tools on the page. Note what is crossing the boundary: not my email.
Counts, sums, top-N lists. The page has nowhere to put a raw message."

---

## Shot 3: categories appear (0:40 to 1:00)

**On screen.** Four category cards animate in: Invoices, Recruiters, Customer tickets,
Newsletters. Hover one so the provenance line is readable: "from Gmail, last 50 threads,
synthetic sample". The audit rail on the right fills with `create_category` entries.

**Spoken.**
"Four categories. I did not name them and I did not pick them; the agent decided what my
work actually looks like. Every card carries the line that says where it came from. This
run is synthetic sample data, and the card says so."

---

## Shot 4: parallel dashboards (1:00 to 1:25)

**On screen.** Four `upsert_dashboard` chips land, ideally overlapping if subagents are
running in parallel. Dashboards fill in behind them: KPIs then charts. Land on the
Invoices dashboard, full width. Let the bar chart and the outstanding KPI sit for two
seconds without narration.

**Spoken.**
"Four dashboards, built at once, one per category. Bar, line, donut, table. This is the
dashboard DSL: the agent sends up to four KPIs and four charts, the page validates every
field and renders it. Nine thousand one hundred and twenty euro outstanding, six open
invoices, and I have not configured a single thing."

---

## Shot 5: the overview (1:25 to 1:40)

**On screen.** Type "Make an overview." `compose_overview` chip, then the overview tab
renders across all four categories.

**Spoken.**
"Now roll it up. The agent picks which numbers deserve the top of the page, because it is
the one that saw the data."

---

## Shot 6: register a monitor (1:40 to 2:05)

**On screen.** Type the monitor prompt. `register_monitor` chip. Cut to the Monitors tab:
the monitor card shows the schedule, the next run, and the policy clauses rendered as
chips: `threshold: amount > 5000`, `requireHumanFor: pay`, `max 2 auto actions per run`.
Then show the scheduled-task prompt the tool handed back, in the ChatGPT reply.

**Prompt typed on camera.**
"Watch the Invoices category every morning at eight, and hold anything over five thousand
euro for me."

**Spoken.**
"This is the part that keeps working after I close the tab. It registers a monitor here,
and it hands me back the exact prompt for a ChatGPT scheduled task that runs on my own
machine every morning. My rule is now on the page, in writing, where I can read it."

---

## Shot 7: the run (2:05 to 2:20)

**On screen.** Press **Run now**. The run log fills in: two findings, two drafts. One
draft card is green and labelled auto, one is amber and labelled **held**, with the clause
`threshold:amount>5000` printed on it. Point the cursor at the clause.

**Spoken.**
"Run it. It found an invoice from Acme Test Ltd for six thousand three hundred euro. It
did not pay it. It held it, and it printed the clause that held it."

---

## Shot 8: the refusal (2:20 to 2:33)

**On screen.** Type "Approve the Acme invoice draft." The `approve_draft` chip appears and
comes back refused. Zoom the reply text so the clause name is legible:
`Refused: clause threshold:amount>5000. A human can approve it from the Monitors tab.`

**Spoken.**
"Watch what happens when I ask the agent to approve it anyway. Refused, by clause name.
That is not the model choosing to be careful. It is a function on the page that returns
false, and the agent cannot talk its way past it."

Hold one full second of silence on the refusal text. This is the shot the judges remember.

---

## Shot 9: the human approves (2:33 to 2:40)

**On screen.** Click **Approve** on the same held card in the Monitors tab. The card flips
to approved. The audit rail writes a new line with actor **human** directly beneath the
refused line with actor **agent**. Freeze on those two lines together.

**Spoken.**
"So I approve it. One click, logged as me, not as the agent. The agent proposes. The human
decides. That is the whole idea."

**End card, 1 second.** `MCP for Work` and the deployed URL.

---

## Recording checklist

- [ ] Model picker visible once, showing Sol or Terra.
- [ ] Site tools indicator and tool count legible at least once.
- [ ] At least six tool-call chips visible on camera, unedited.
- [ ] Provenance line readable in shot 3.
- [ ] Clause text readable in shots 7 and 8.
- [ ] Audit rail showing `agent` refused and `human` approved, adjacent, in shot 9.
- [ ] No real name, real address, real company or real inbox in any frame.
- [ ] Under 3 minutes, per the challenge rules.
