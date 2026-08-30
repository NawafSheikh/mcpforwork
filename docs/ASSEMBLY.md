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
