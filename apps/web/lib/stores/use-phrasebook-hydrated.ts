"use client";

import { useEffect, useState } from "react";
import { usePhrasebookStore } from "@/lib/stores/phrasebook";

export function usePhrasebookHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    typeof window !== "undefined"
      ? usePhrasebookStore.persist.hasHydrated()
      : false,
  );

  useEffect(() => {
    if (usePhrasebookStore.persist.hasHydrated()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- persist may already be hydrated on client
      setHydrated(true);
      return;
    }
    return usePhrasebookStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  return hydrated;
}