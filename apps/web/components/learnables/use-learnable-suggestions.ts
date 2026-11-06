"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  filterNewLearnables,
  saveLearnablesToPhrasebook,
} from "@/lib/learnables";
import { usePhrasebookStore } from "@/lib/stores/phrasebook";
import type {
  CharacterSet,
  LearnableSuggestion,
  LearnablesResponse,
  VoiceRegion,
} from "@mindyourlanguage/shared";

function phrasebookChineseTexts(): string[] {
  return usePhrasebookStore.getState().items.map((entry) => entry.translation);
}

/**
 * After EN→ZH translate: fetch a few new learnables, let the user save them.
 * Lives here so the home page stays orchestration.
 */
export function useLearnableSuggestions(
  voiceRegion: VoiceRegion,
  characterSet: CharacterSet,
) {
  const [items, setItems] = useState<LearnableSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  // Ignore late responses after clear() or a newer load().
  const requestIdRef = useRef(0);

  function clear() {
    requestIdRef.current += 1;
    setItems([]);
    setLoading(false);
  }

  async function load(
    sourceText: string,
    translation: string,
    knownTranslations: string[],
  ) {
    const requestId = ++requestIdRef.current;
    setItems([]);
    setLoading(true);

    try {
      const response = await fetch("/api/learnables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText,
          translation,
          knownTranslations,
          voiceRegion,
        }),
      });
      if (requestId !== requestIdRef.current) return;

      if (!response.ok) {
        setItems([]);
        return;
      }

      const data = (await response.json()) as LearnablesResponse;
      // Re-filter against the live phrasebook in case it changed while we waited.
      setItems(filterNewLearnables(data.items ?? [], phrasebookChineseTexts()));
    } catch {
      if (requestId === requestIdRef.current) setItems([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  function saveSelected(selected: LearnableSuggestion[]) {
    const savedCount = saveLearnablesToPhrasebook(selected, characterSet);

    if (savedCount === 0) {
      toast.success("Those are already in your phrasebook");
      return;
    }

    setItems((prev) => filterNewLearnables(prev, phrasebookChineseTexts()));
    toast.success(
      savedCount === 1
        ? "Saved 1 new bit to phrasebook"
        : `Saved ${savedCount} new bits to phrasebook`,
    );
  }

  return {
    items,
    loading,
    visible: loading || items.length > 0,
    clear,
    load,
    saveSelected,
  };
}
