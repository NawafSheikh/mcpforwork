/**
 * useCapabilities(): the cards on this board, and the one this browser publishes.
 *
 * The person's own card is a person card signed with their display name; an agent
 * publishes its own through the publish_capabilities tool. Both land in the same place
 * and sync as the same entity.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { displayName } from "../feedback/identity";
import { inRoom } from "../packs/host";
import { enabledPackIds } from "../packs/state";
import { useShell } from "../shell/context";
import type { Capability } from "../types";
import { capabilityFor, listCapabilities, publishCapability } from "./state";

export interface CapabilitiesApi {
  readonly cards: readonly Capability[];
  /** This browser's own card, if the person has published one. */
  readonly mine: Capability | null;
  /** Publish or replace the person's card. Site packs are measured, not declared. */
  publish(local: readonly string[], knows: readonly string[]): void;
}

export function useCapabilities(): CapabilitiesApi {
  const { store } = useShell();
  const [cards, setCards] = useState<readonly Capability[]>(() => listCapabilities(store.get()));

  useEffect(() => {
    setCards(listCapabilities(store.get()));
    return store.subscribe((ws) => setCards(listCapabilities(ws)));
  }, [store]);

  const name = displayName();
  const mine = useMemo(
    () => cards.find((card) => card.owner.name === name) ?? null,
    [cards, name],
  );

  const publish = useCallback(
    (local: readonly string[], knows: readonly string[]) => {
      void store.update((ws) =>
        publishCapability(ws, {
          owner: { kind: "person", name: displayName() },
          packs: enabledPackIds(ws, inRoom()),
          local,
          knows,
          updatedAt: new Date().toISOString(),
        }),
      );
    },
    [store],
  );

  return { cards, mine, publish };
}

/** The card for one name, read straight from the store. */
export function useCapability(name: string): Capability | null {
  const { store } = useShell();
  const [card, setCard] = useState<Capability | null>(() => capabilityFor(store.get(), name));
  useEffect(() => {
    setCard(capabilityFor(store.get(), name));
    return store.subscribe((ws) => setCard(capabilityFor(ws, name)));
  }, [store, name]);
  return card;
}
