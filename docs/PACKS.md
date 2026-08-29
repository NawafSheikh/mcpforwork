# Tool packs: what an agent may do in this room is decided on the page

## Packs
A pack is a named group of site tools with a description, a risk level and an owner.
- Built-in packs: `board` (categories, dashboards, overview), `workspaces` (more than one
  board in this browser, one per project), `datasets` (drop and profile files), `notes`
  (feedback in all four directions), `turns` (claims, versions), `monitors` (policies,
  runs, approvals), `rooms` (invite, presence).
- Work packs (catalog, delivered later through a local bridge): Teams, Power Apps canvas, Fabric,
  Dynamics 365, Zendesk, Word, Windows, n8n. Each lists its tools, what it needs on the
  machine, and whether it reads, writes, or sends.

## Control from the page
- The Tools panel shows every pack with a switch. Outside a room the person decides; inside a
  room only the host can change switches, and the change syncs to every peer.
- Switching a pack off unregisters its tools from `document.modelContext` immediately, so an
  agent mid-task loses those tools on its next call and is told why in the tool result of any
  remaining tool ("The monitors pack is off in this room; ask the host").
- Risky packs (anything that sends or pays) default off in rooms and always require a policy.

## Capabilities card
Every person and every agent in the room has a card: packs enabled on the site, tools they
declare they have locally (free text until the bridge exists, then measured), and a note on what
they know ("Fabric lakehouse owner", "D365 finance"). Cards are readable through
`list_capabilities`; a request to an agent can name the capability it needs.

## Catalog
The catalog page lists work packs with a status per visitor: available on the site, installed
locally (bridge), or coming. Free packs first; company packs private to a room later.
