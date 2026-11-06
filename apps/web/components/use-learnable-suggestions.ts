"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  filterNewLearnables,
} from "@/lib/learnables-shared";
import { saveNewLearnables } from "@/lib/learnables-to-phrasebook";
import { isChineseAlreadySaved, usePhrasebookStore } from "@/lib/stores/phrasebook";
import type {
  CharacterSet,
  LearnableSuggestion,
  LearnablesResponse,
  VoiceRegion,
} from "@mindyourlanguage/shared";

/**
 * Loads "new bits to learn" after an EN→ZH translate and saves selected ones.
 * Keeps request/response and phrasebook write logic out of the home page.
 */
export function useLearnableSuggestions(
  voiceRegion: VoiceRegion,
  characterSet: CharacterSet,
) {
  const [items, setItems] = useState<LearnableSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  // Bumped on clear / new load so a slow response cannot overwrite newer state.
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
      setItems(filterNewLearnables(data.items ?? [], knownTranslations));
    } catch {
      if (requestId !== requestIdRef.current) return;
      setItems([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  function saveSelected(selected: LearnableSuggestion[]) {
    const savedCount = saveNewLearnables(selected, characterSet);

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
