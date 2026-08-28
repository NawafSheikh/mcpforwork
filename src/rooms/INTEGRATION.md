# Wiring rooms into the shell (A10 -> orchestrator)

`src/rooms` is self-contained and touches nothing outside itself. Six things have to be
wired by the owners of the shell, the store and the WebMCP contract. Everything below is
already exported from `src/rooms`.

## 1. Store key switch on `?room` (src/main.tsx, A4/A9)

A room-scoped board persists under its own IndexedDB key so two rooms and the local board
never overwrite each other.

```ts
import { currentRoomSlug, roomStoreKey } from "./rooms";
import { createWorkspaceStore } from "./store";

const slug = currentRoomSlug();                    // reads ?room=, never the #fragment
const store = slug === null
  ? createStore({ mode })                          // unchanged path
  : createWorkspaceStore({ mode, key: roomStoreKey(slug) });
```

`hasShareFragment()` still wins over `?room=`: a `#share=` link is a frozen snapshot and
must not join anything. Check the fragment first, exactly as today.

## 2. Start sync and register the runtime (src/main.tsx, after the store exists)

```ts
import { set as idbSet } from "idb-keyval";
import { configureRooms, currentRoomSlug, joinRoom, leaveRoom, roomJoinUrl, roomStoreKey } from "./rooms";

configureRooms({
  store,
  label: "Guest",                                  // or a name the visitor typed
  agent: false,                                    // flipped in step 4
  onRoom: (slug) => {
    history.replaceState(null, "", roomJoinUrl(slug));   // put ?room= in the address bar
    void idbSet(roomStoreKey(slug), store.get());        // keep the board across a reload
  },
});
const slug = currentRoomSlug();
if (slug !== null) joinRoom(slug);                 // create_room does this later, on demand
window.addEventListener("pagehide", () => leaveRoom(), { once: true });
```

`onRoom` is where the store owner decides how to re-key persistence. `src/rooms` never
touches IndexedDB itself, because the store owns its key.

## 3. Register the two tools (src/webmcp, A2)

The names are not in `toolSchemas` yet, so three merges are needed and then the handlers
drop in like any other module's:

```ts
// src/webmcp/schemas.ts
import { roomToolSchemas } from "../rooms";
export const toolSchemas = { ...existing, ...roomToolSchemas } as const;

// src/webmcp/jsonSchemas.ts   -> { ...existing, ...roomJsonSchemas }
// src/webmcp/definitions.ts   -> DESCRIPTIONS: { ...existing, ...roomToolDescriptions }
// src/webmcp/annotations.ts   -> READ_ONLY_TOOLS + ROOM_READ_ONLY_TOOLS
//                               UNTRUSTED_CONTENT_TOOLS + ROOM_UNTRUSTED_CONTENT_TOOLS

// src/shell/adapters/webmcp.ts
createWebmcp({ store, handlers: { ...monitorHandlers, ...roomHandlers } });
```

`roomHandlers` already has the registry's `(input, ws) => { next?, result }` signature and
returns no `next`, because opening a room does not change the board.

## 4. Header: "Invite to room" button and the presence chip (src/shell/Header.tsx, A4/A9)

Sits next to Share, in `HeaderActions`, hidden when `snapshot` is true.

- Label: **Invite to room** when `usePresence().slug === null`, **Copy room link** after.
- Click: `const room = getRoomRuntime() ?? createRoom(); if (!isJoinFailure(room)) await copyText(room.joinUrl())`,
  then the same toast Share uses ("Room link copied. Anyone with it can edit this board.").
- On a failure, show `chooseTransport().note` verbatim: it already says why.
- Chip, left of the WebMCP status pill, rendered only when `slug !== null`:
  `usePresenceLabel()` gives "2 people, 2 agents here"; `usePresence().status` gives
  `open | connecting | error` for the dot colour, same classes as `mfw-pill-ok/warn`.
- Tell the visitor the truth in the title attribute: "Anyone with the link can join and
  edit. The relay never keeps your board."

Flip the agent count from the WebMCP status the shell already has:

```ts
useEffect(() => { getRoomRuntime()?.setAgent(status.available && status.registered > 0); },
  [status.available, status.registered]);
```

## 5. Environment variables (docs/DEPLOY.md, A5)

Rooms reuse live mode's two variables and add nothing:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

With both set, rooms relay through a Supabase Realtime public broadcast channel and work
across machines. With either missing, `chooseTransport()` falls back to BroadcastChannel,
which reaches other tabs of the same browser profile only, and the UI must say so. No
Supabase table, no RLS policy and no SQL is required: the channel is `private: false`.

## 6. Nothing else

No new npm dependency. The phoenix frames are hand rolled over the native WebSocket in
`src/rooms/supabase.ts`, verified against the Realtime protocol docs on 28 Aug 2026.

## Honest limits to keep in the copy

- A room is unlisted, not private. The slug is the whole access control, so anyone with
  the link can read and write the board. There is no sign-in in v1.
- The relay forwards and forgets. Nothing about the board is stored: it exists only in the
  browsers that are in the room, and an empty room holds nothing.
- The shared board includes the audit rail on purpose, so callers and humans from every
  browser land in one trail. Do not open a room on a board you would not show the guests.
- Free-plan Supabase Realtime caps: 200 concurrent clients, 100 messages per second and a
  256 KB payload. A board too big for one message is not synced to a late joiner; the drop
  is written to the rail as actor `system`, tool `room_sync`.
