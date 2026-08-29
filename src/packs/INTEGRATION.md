# Wiring tool packs and capability cards (owner A20)

Five edits, none of them inside `src/packs` or `src/capabilities`. Everything below is
already exported; nothing here needs a new file.

## 1. One controller, passed to both halves of the registry

`src/shell/adapters/webmcp.ts`, in `registerTools(store, signal)`:

```ts
import { createPackController } from "../../packs";
import { capabilityHandlers } from "../../capabilities";

const packs = createPackController(store);
const bundle = createWebmcp({ store, handlers: { ...handlersFor(), ...capabilityHandlers }, packs });
void registerAllTools(bundle.registry, bundle.definitions, {
  signal,
  packs,
  onRegistered: (names) => setStatus({ available: true, registered: names.length }),
});
```

Two things happen here and both matter:

- `packs` on `createWebmcp` reaches `createToolRegistry`, so a call to a tool whose pack
  is off is refused with `The <pack> pack is off in this room; ask the host.` and audited
  as a failure. Without it the tool is unregistered but a stale tool list still gets
  through.
- `packs` on `registerAllTools` gives each pack its own AbortController and follows the
  switches for the life of the page. `onRegistered` fires on the first pass and after
  every switch, which is what keeps the "Site tools on: N" pill honest.

`createWebmcp` already forwards `packs` and `handlers`; `capabilityHandlers` is the only
handler merge left, and without it `publish_capabilities` answers "not wired yet".

## 2. The Tools panel

`PacksPanel` from `src/packs` is the whole body of the Tools popover in the top bar. It
needs no props and renders its own three sections: the six built-in packs with switches,
Local bridge, and the work-pack catalog. It reads the store through `useShell()`, so it
must be inside `ShellProvider`.

```tsx
export { PacksPanel } from "../../packs";
```

That one line replaces the placeholder in `src/shell/adapters/packs.tsx`.

## 3. Capability cards in the left rail

```tsx
export { CapabilityCards } from "../../capabilities";
```

`CapabilityCards` renders one `CapabilityCard` per card, empty state included. Pass
`onAsk` if the shell would rather intercept the "ask this agent" click than take it off
the event bus:

```tsx
<CapabilityCards onAsk={(target, text) => composer.open(target, text)} />
```

Without `onAsk` the card emits on `askCapability` instead, and the composer subscribes:

```ts
import { askCapability } from "../../packs";
useEffect(() => askCapability.subscribe(({ target, text }) => composer.open(target, text)), []);
```

`target` is already `add_feedback` shaped: `{ kind: "agent" | "person", id: name }`.

## 4. Bridge toasts

The local bridge reports its queue and its boundary refusals on the `packToasts` bus.
Anything already rendering toasts can pick them up in three lines:

```ts
import { packToasts } from "../../packs";
useEffect(() => packToasts.subscribe((toast) => push(toast.text, toast.tone)), []);
```

`packToasts.recent()` holds the last eight, so a panel that mounts late still has
something to draw. A `queue.refused` toast is a held draft, not an error: it says what the
robot would have done and which clause stopped it.

## 5. CSP

The local bridge is a WebSocket to loopback. Add to the `connect-src` directive in
`index.html` and `vercel.json`:

```
ws://127.0.0.1:* ws://localhost:*
```

Nothing else changes; browsers already treat loopback as a secure origin, and the bridge
refuses any page whose origin it does not recognise. Without this line the connect button
fails silently in production and works in dev, which is the worst of both.

## What this module does not do

- It never connects to the bridge on its own. A person presses Connect.
- It never writes a switch for somebody who is not the host of the room.
- It adds no dependency: the bridge protocol is spoken here, not imported.
