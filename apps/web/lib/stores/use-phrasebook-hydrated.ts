"use client";

import { useEffect, useState } from "react";
import { usePhrasebookStore } from "@/lib/stores/phrasebook";

/**
 * Starts `false` on the server AND on the first client render so hydration
 * markup always matches, then flips to the real persist state in an effect.
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
