# A workspace assembles itself around what it is for

Written 30 Aug 2026, from Nawaf's description of the first five minutes.

The flow, in his words: you land, you already have a workspace, you can rename it or make
another. Your agent asks what this one is for. You answer in a sentence. It goes and finds
the skills and MCPs that serve that purpose, including the ones you already own on your own
machine, and this page lists what it picked. You add the devices you want in: a phone over
adb, a robot on wifi, a camera. Agents take names for themselves so two of them are not
both called Codex. Other people join and their agents bring their own tools with them.

## What the page already does

| The flow needs | State |
|---|---|
| A workspace already there on landing, renameable, and more on demand | **Shipped.** `src/workspaces`, 5 tools, the top-bar panel. |
| Somewhere to put "what this is for" | **Half.** A workspace entry carries a `note`; nothing asks for it. |
| Tools the room can turn on and off live | **Shipped.** 7 packs, switches, live unregistration from `document.modelContext`. |
| Your own machine's tools in the room | **Shipped in shape.** The bridge serves packs over `ws://127.0.0.1:7331`, signed, and can already run a stdio MCP server (`src/packs/mcpStdio.ts`). Nothing discovers what you have installed. |
| A device as a room member | **Shipped for one device.** The robot pack is offered only when real hardware answers a read-only probe, and must declare a stop and a boundary. No phone, no camera. |
| Who can reach what, readable by everyone | **Shipped.** `publish_capabilities` / `list_capabilities`. |
| Handing work to another person's agent | **Shipped as notes.** `add_feedback` addressed to an agent by name; the other agent picks it up from its own `list_feedback`. No task object yet. |
| Agents with distinct names | **Not built.** `caller` is self-declared and defaults to "ChatGPT". Two Codexes are both "Codex". |
| The agent choosing the tools for the purpose | **Not built.** |

So the spine exists. What is missing is the first five minutes: a purpose, a name per agent,
and the agent assembling the toolset instead of a human flipping seven switches.

## What gets built

### 1. Agents name themselves (`join_as`)

An agent's first call claims a name for this room. The page keeps names unique: ask for
"Codex" when a Codex is already here and you are told you are "Codex 2", or better, that a
name saying whose you are is what everyone else will read. The name it gets back is the
`caller` it passes on every later call, so the rail, the claims, the capability cards and
every addressed note all say who actually did the thing.

This is small and it is the difference between a legible demo and two identical rows.

### 2. The workspace has a purpose (`set_purpose`)

One sentence on the workspace: "close the August supplier invoices", "get the Android build
green". It is asked for on first run, it is what `create_workspace` already takes as `note`,
and it is the input to everything below. A person can type it; the agent can write it after
asking.

### 3. The agent assembles the toolset (`propose_tools`, `set_tools`)

Given the purpose, the agent reads what is available: the site packs, the packs this
browser's bridge is serving, and the capability cards of everyone else in the room. It calls
`propose_tools` with what it wants on and one line each saying why. The page shows that as a
list a person confirms or edits, then switches exactly those packs on and the rest off.

Two rules, and both matter for a room with other people in it:
- Anything that sends, pays or moves is proposed but never switched on by a tool. A person
  turns those on.
- In a room, only the host's confirmation moves the switches, as today.

The page ends up showing what Nawaf asked for: the list of tools the agent chose for this
purpose, with the reason next to each, and a switch.

### 4. Your own MCPs, skills and plugins (bridge discovery)

The bridge already speaks stdio MCP. It gains a read-only discovery step: what MCP servers
are configured on this machine, what skills exist, what CLIs are on PATH. It offers them to
the page as packs with their real names, and the page shows them alongside the site packs
with "on your machine" against them. Nothing is enabled by discovery; discovery only makes
them offerable.

Nothing about another person's machine is ever reachable directly. If their agent has the
tool, you ask their agent. That is the same rule that makes the whole thing safe.

### 5. Devices

The robot is the proof the shape works: real probe, declared stop, declared boundary,
refused registration without both. The same shape extends to a phone over adb (a device
answers `adb devices`, so it exists) and a camera (it answers a read-only info call). Each
is a bridge pack with a risk level, and `move` risk still needs a stop and a boundary.

### 6. Tasks, and the AIOS mission packet

Delegation stops being a note and becomes an object: `Task { title, detail, state, owner,
from, blockedOn, records[] }`, five tools, and the centre column renders the lanes. An owner
can be another person's agent by name. Evidence is required to finish. That is the harness's
mission-and-evidence idea, on a board two people and four agents can all see.

`Task` and its limits are already in `src/types.ts`.

## Build order, and where the cut line falls

Three build days: today, Monday, Tuesday. Wednesday is submit.

1. **`join_as`** (today). Cheap, and everything else reads better once agents have names.
2. **Purpose + `propose_tools`** (today). The novel bit, and the one that is most clearly a
   WebMCP story: the page decides what the agent may use, and the agent argues for it.
3. **Tasks and the lane board** (Monday). The delegation substrate and the thing the video
   shows moving.
4. **Bridge discovery of local MCPs and skills** (Monday). The "use what you already own"
   half of the story.
5. **A device beyond the robot** (Tuesday, only if 1 to 4 are done and green).

If Monday night is not green, 5 goes, then 4. 1 to 3 ship regardless: they are the demo.


## 30 Aug, later: two corrections that change the shape

### The page must not be a form the agent fills in

"Why are we giving fixed charts and imposing our policies? What if the users want
something completely different, like a Gantt chart? Why do they have to put values in a
pre-defined shape that we have set?"

Right. `upsert_dashboard` takes one to four KPIs and up to four charts from a list of four
kinds. That is a dashboard product's shape, imposed on an agent that is supposed to be
creating.

The first answer was a block grammar the agent composes: safer than HTML, still our
vocabulary. The better answer came next.

### Agents run code on their own machine and show the result here

"Let agents execute code locally and show on our page."

This dissolves the problem instead of negotiating with it. The page was never the right
place to run anything. The agent's own machine already is, through its own bridge, which
its own person switched on.

- `run_code` is a bridge pack: python or node, in a scratch directory, wall-clock timeout,
  output capped, on **the machine of the person whose agent called it** and nowhere else.
- What comes back to the page is the result, not the code's power: text, a table, or a
  raster image as a data URL. No HTML, no SVG, nothing that executes. A picture is data.
- The run record carries **the code, the output and the artifact together**, so a person
  reads what actually ran rather than trusting a summary.
- A Gantt chart is now "matplotlib, here is a PNG". So is anything else, and we never had
  to invent a vocabulary for it.
- Risk is `write` or higher, so in a room it is off by default and a person turns it on.

The block grammar is dropped. It was a worse answer to a question that has a better one.

### Nobody types notes on a web page when their agent is right there

"Why would someone write notes on our page when they could just say it to ChatGPT?"

They would not, and pretending otherwise is the ceremony we said we would not build. A
person talks to their own agent, in their own chat, where they already are.

So the page stops being somewhere you type. It is where:

1. **What agents did is visible**, with who did it and on whose machine.
2. **How they chose, and why, is visible.** This is the thing the product is actually for.
   Not a summary after the fact: the options an agent had, the one it took, the reason, the
   clause that stopped it, who it is waiting on.
3. **Work reaches agents your own chat cannot reach**, which is the one thing a note is
   genuinely for: a request addressed to somebody else's agent on somebody else's machine.

`add_feedback` stays, because (3) is real. It stops being sold as "leave a comment". The
human's job on this page is to read decisions and disagree with one, which is a button and
not a text box.

### What that makes the build

1. `join_as`. **Done.**
2. `run_code` on the bridge, artifacts rendered on the page.
3. `decide`: a first-class record of what an agent considered, what it chose and why,
   synced like everything else and rendered as a chain a person can argue with.
4. Tasks stay minimal: they are what gets delegated, and they render through the run and
   decision records rather than a bespoke lane board.

Cut: the block grammar, and the bespoke task board UI.
