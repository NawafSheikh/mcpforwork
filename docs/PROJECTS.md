# Projects: how two people and four agents build things together

Written 29 Aug 2026. The method that built MCP for Work in a day (a shared contract, path
ownership, evidence gates, one place for decisions) turned into objects on the board.

## The Project object
- `Project { id, name, kind: web|android|extension|watch|document|mcp|other, repo?, bridgeOwner,
  plan: Task[], knowledge: Knowledge[], packet: ResumePacket }`.
- The repository is the source of truth for code; the board is the work surface over it. For
  documents the board holds the sections; export goes through a docs pack.

## Tasks
- `Task { id, title, contract (paths, interfaces, acceptance), owner?, status, claim?, evidence:
  Record[], requests: Feedback[] }`.
- A task is claimed automatically when an agent starts it; a person can take it with one click.
- Agents work on their person's machine through their bridge, in their own clone and branch.
- Evidence records come from packs: build passed, tests green, screenshot, APK installed,
  extension loaded, watch face rendered, document exported. No record, no done.

## Merge queue
- Every pushed branch becomes a queue item with its evidence. Merging is a decision by a person
  or by a policy ("auto-merge when checks pass and no path overlap"). Conflicts are held items
  with a clause, visible to everyone.

## Documents
- `Document { sections: Section[] }`; sections are the unit of claims and notes. `upsert_section`
  for agents, inline editing for people, comments as notes addressed to whoever should act.
  Versions are records. Export and import through a docs pack on the bridge.

## Building MCPs together
- Tool specs live on the board first (name, schema, description as cards). Agents implement in
  the repo through the bridge; the round-trip test is the evidence; `publish_pack` puts the
  result in the catalog; other rooms install it through their bridge.

## Knowledge
- `Knowledge { id, subject (project or system), text, author, version, supersedes?, confidence }`,
  read by every agent before acting on that subject (`list_knowledge`), written by people and
  agents (`upsert_knowledge`). Contradictions are flagged, never silently replaced.
- Lessons: when a task ends, the agent writes what failed and what fixed it. Prompts, recipes
  and skills are promoted only when they beat the current version on records.

## Resume packet
- Every project keeps `{ nextStep, openRequests, claims, lastEvidence, updatedAt }`. `get_project`
  returns it first, so any person or agent knows what to do in ten seconds.

## Nothing lives only in a chat
- Repo commits, run records, knowledge objects and room state are where progress lives. A chat
  window closing loses nothing.
