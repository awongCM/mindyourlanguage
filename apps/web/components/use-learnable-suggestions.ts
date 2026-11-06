"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  filterNewLearnables,
  phrasebookFieldsFromLearnable,
} from "@/lib/learnables-shared";
import { createInitialPracticeStats } from "@/lib/practice/srs";
import {
  createPhrasebookEntry,
  isChineseAlreadySaved,
  usePhrasebookStore,
} from "@/lib/stores/phrasebook";
import type {
  CharacterSet,
  LearnableSuggestion,
  LearnablesResponse,
  VoiceRegion,
} from "@mindyourlanguage/shared";

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
      const knownNow = usePhrasebookStore
        .getState()
        .items.map((entry) => entry.translation);
      setItems(filterNewLearnables(data.items ?? [], knownNow));
    } catch {
      if (requestId === requestIdRef.current) setItems([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  function saveSelected(selected: LearnableSuggestion[]) {
    const { add } = usePhrasebookStore.getState();
    let savedCount = 0;

    for (const item of selected) {
      // Re-read after each add so two identical chinese picks in one click still dedupe.
      if (
        isChineseAlreadySaved(usePhrasebookStore.getState().items, item.chinese)
      ) {
        continue;
      }

      add(
        createPhrasebookEntry({
          ...phrasebookFieldsFromLearnable(item, characterSet),
          dictionaryMatches: [],
          segments: [],
          practiceStats: createInitialPracticeStats(),
        }),
      );
      savedCount += 1;
    }

    if (savedCount === 0) {
      toast.success("Those are already in your phrasebook");
      return;
    }

    const afterSave = usePhrasebookStore.getState().items;
    setItems((prev) =>
      prev.filter((item) => !isChineseAlreadySaved(afterSave, item.chinese)),
    );
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
