# Mounting the room thread and the name chip (A15, nothing here is wired yet)

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

Blocker for cross-browser handover: `src/share/ops.ts:40` whitelists the four old target
kinds and `:150` coerces anything else to "dashboard", and `coerceFeedback` (`:163`) drops
`from`. Until A9 widens both, an addressed note survives locally but arrives in the other
browser as a dashboard note with no signature.
