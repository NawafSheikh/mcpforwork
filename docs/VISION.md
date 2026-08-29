# Where MCP for Work goes

## The gap
ChatGPT, Claude and Codex are single-player: one person, one agent, one chat, and the output
dies with the thread. Work is multiplayer. Teams share documents, dashboards, decks, small
internal tools and, above all, knowledge about how their systems behave. Today none of that is
a place where a person and an agent, or two people and their two agents, can act on the same
object, see each other's moves, and hold each other to rules.

## The thesis
MCP for Work is the shared surface for people and their agents. WebMCP is the door: any agent
that can browse gets typed hands on the objects in the room. The page keeps the objects, the
audit and the guardrails; the agents bring the intelligence; the humans keep the decisions.

## What exists today (the contest build)
- Shared objects mutated through one typed contract by humans and agents alike: categories,
  dashboards, monitors, drafts, notes.
- Rooms: several people, several agents, one board, presence, live sync, one audit rail.
- Knowledge crossing the line in both directions: notes for the agent, agent narrative for the
  humans, list_feedback as the handoff.
- Guardrails as a first-class object: a policy the human writes, an engine that refuses by clause.

## What comes next, in order of leverage
1. More object types with the same tool trio (get, upsert, feedback): documents, slide decks,
   small internal tools, website drafts. The board becomes a workspace of artifacts.
2. Shared knowledge objects: "how this data works" attached to a dataset or a system (a Fabric
   lakehouse, a D365 entity, a Zendesk queue), read by every agent in the room before it acts.
   This compounds per team and is the moat.
3. Execution under rules: monitors and approvals generalised beyond invoices, so an agent can
   ship a notebook change or a deck revision under a policy a person wrote.
4. Identity: named people and named agents, so the rail reads "Nawaf's agent proposed, Maria
   approved", with roles and persistent boards for companies.

## Why the name
Model Context Protocol gave agents tools. WebMCP put those tools on web pages. MCP for Work is
the place where that becomes a team's workday.

## Roadmap after the turn model (29 Aug 2026)

### Secure rooms
- End-to-end encrypted rooms: the key lives in the invite fragment, never reaches the relay;
  patches are AES-GCM ciphertext on the relay, which already stores nothing and then cannot read.
- Host-approved joins with roles: viewer, editor, host. Only the host edits guardrails.
- Trust on notes: author, membership and kind travel with every note; the agent is told what came
  from outside the team. The page never acts on a machine: site tools touch the board only.

### Capabilities and routing
- A capabilities card per person and per agent, published on purpose: connectors, skills, MCP
  servers, systems they know. Readable by the room through list_capabilities.
- Requests route to capability: an agent that lacks Fabric knowledge asks the agent that has it
  by leaving a note addressed to it; the answer lands on the board. Access never travels,
  the request does. Opt in per capability; choose who may ask.

### Projects and outputs
- A board is a project; a person has many; rooms hold boards. Outputs are objects: dashboards
  today, documents, decks, checklists and small tools next, all through the same tool trio.

### Evolving ways of working
- Recipes: a named prompt plus a tool sequence, shareable in the room.
- Templates: dashboards, policies, checklists.
- Room rules: claim timeouts, who may approve, thresholds, quiet hours.
- Artifacts: a generic object with a user-defined schema so a team adds its own object types
  without new code. Composition of existing tools, never arbitrary code in the page.

### Multi-vendor by construction (proven 29 Aug 2026)
- A Claude-driven browser joined a live room through document.modelContext, saw all 25 tools,
  created a dashboard and left a note addressed to any agent, on the board a ChatGPT had built.
  Turns are addressed requests; the model behind each turn is whatever that person runs.
