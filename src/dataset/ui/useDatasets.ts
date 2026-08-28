/**
 * Subscription to the in-memory dataset registry (owner A11).
 * A plain useState mirror rather than useSyncExternalStore, because profiles() builds
 * a fresh array each call and React would spin on an unstable snapshot.
 */

import { useEffect, useState } from "react";
import { datasetMemory, type DatasetRegistry } from "../memory";
import type { DatasetProfile } from "../types";

export function useDatasets(registry: DatasetRegistry = datasetMemory): readonly DatasetProfile[] {
  const [profiles, setProfiles] = useState<readonly DatasetProfile[]>(() => registry.profiles());
  useEffect(() => {
    setProfiles(registry.profiles());
    return registry.subscribe(() => setProfiles(registry.profiles()));
  }, [registry]);
  return profiles;
}
