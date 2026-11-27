"use client";

import { useEffect, useState } from "react";
import { usePhrasebookStore } from "@/lib/stores/phrasebook";

/**
 * Hydration gate for the persisted phrasebook store.
 *
 * Starts `false` on the server AND on the first client render so hydration
 * markup always matches, then flips to the real persist state in an effect.
 *
 * WHEN TO USE IT: gate only where render code calls store *functions* or
 * `persist.*` APIs (e.g. `getDueCount()`, `getSpeedCount()`,
 * `getPracticeCount()`, `persist.hasHydrated()`), because those read the
 * localStorage-backed state that differs between server and first client
 * paint. Reading plain selected state (`usePhrasebookStore((s) => s.items)`)
 * is safe without the gate: zustand 5 uses `useSyncExternalStore` with the
 * initial state as the server snapshot, so selected state matches during
 * hydration. Don't add needless gates, and don't skip one where a store
 * function is called during render.
 */
export function usePhrasebookHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (usePhrasebookStore.persist.hasHydrated()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration gate: must start false on server and first client paint
      setHydrated(true);
      return;
    }
    return usePhrasebookStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  return hydrated;
}
