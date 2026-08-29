# Mounting the room thread and the name chip (A15; wired by A16 on 29 Aug 2026)

Three mounts, all optional, none of them done by this module:

1. `<RoomRequests />` from `src/feedback`: mount once per page, next to presence (the
   Board tab or the Header popover). It is the one thread carrying every note addressed to
   an agent, a person or the room, and its input writes `{kind: "room", id: "room"}`.
2. `<NameChip onRename={...} />` from `src/feedback`: mount in the header beside the
   presence chip. It edits `displayName()` (localStorage `mfw:name`, default "Someone"),
   which signs every note this browser leaves.
3. Feed the same name into room presence: pass `label: displayName()` in the `configureRooms`
   host (consumed at `src/rooms/runtime.ts:20` and `:67`, defaulted at `src/rooms/sync.ts:92`)
   and call `getRoomRuntime()?.setLabel(name)` from `onRename` (`src/rooms/sync.ts:325`).

All three are done: `<RoomRequests />` hangs off the header's Requests button
(`src/shell/RequestsButton.tsx`, badge = open addressed notes), `<NameChip />` sits next to
the presence chip and pushes every rename into `getRoomRuntime()?.setLabel(name)`, and
`configureRooms({ label: displayName() })` runs in `src/main.tsx`.

The cross-browser blocker is fixed too: `src/share/ops.ts` now accepts all seven target
kinds and `coerceFeedback` copies `from` (capped at `LIMITS.maxCallerChars`), so an
addressed note keeps its target and its signature through a room patch and a share link.
The regression test is `src/share/__tests__/addressed.test.ts`.
