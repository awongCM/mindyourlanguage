"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  savePracticeChunksToPhrasebook,
  type PracticeChunkParentInput,
} from "@/lib/practice-chunks";
import type {
  CharacterSet,
  PracticeChunkSuggestion,
  PracticeChunksResponse,
  VoiceRegion,
} from "@mindyourlanguage/shared";

export function usePracticeChunks(
  voiceRegion: VoiceRegion,
  characterSet: CharacterSet,
) {
  const [items, setItems] = useState<PracticeChunkSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestEmpty, setSuggestEmpty] = useState(false);
  const requestIdRef = useRef(0);

  function clear() {
    requestIdRef.current += 1;
    setItems([]);
    setLoading(false);
    setSuggestEmpty(false);
  }

  async function load(sourceText: string, translation: string) {
    const requestId = ++requestIdRef.current;
    setItems([]);
    setSuggestEmpty(false);
    setLoading(true);

    try {
      const response = await fetch("/api/practice-chunks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText,
          translation,
          characterSet,
          voiceRegion,
        }),
      });
      if (requestId !== requestIdRef.current) return;

      if (!response.ok) {
        setItems([]);
        if (requestId === requestIdRef.current) setSuggestEmpty(true);
        return;
      }

      const data = (await response.json()) as PracticeChunksResponse;
      if (requestId !== requestIdRef.current) return;
      const nextItems = data.items ?? [];
      setItems(nextItems);
      setSuggestEmpty(nextItems.length === 0);
    } catch {
      if (requestId === requestIdRef.current) {
        setItems([]);
        setSuggestEmpty(true);
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  function saveSelected(
    selected: PracticeChunkSuggestion[],
    parent: PracticeChunkParentInput,
  ) {
    if (selected.length === 0) {
      toast.error("Pick at least one chunk");
      return;
    }
    const valid = selected.filter(
      (item) => item.english.trim() && item.chinese.trim(),
    );
    if (valid.length === 0) {
      toast.error("Each selected chunk needs English and Chinese text");
      return;
    }

    const { savedChunkCount, skippedChunkCount } = savePracticeChunksToPhrasebook({
      parent,
      chunks: valid,
      characterSet,
    });

    if (savedChunkCount === 0 && skippedChunkCount > 0) {
      toast.success(
        skippedChunkCount === 1
          ? "Phrase saved; that chunk is already linked to this phrase"
          : `Phrase saved; ${skippedChunkCount} chunks are already linked to this phrase`,
      );
      clear();
      return;
    }

    if (skippedChunkCount > 0) {
      toast.success(
        savedChunkCount === 1
          ? `Saved phrase and 1 practice chunk (${skippedChunkCount} skipped, already linked)`
          : `Saved phrase and ${savedChunkCount} practice chunks (${skippedChunkCount} skipped, already linked)`,
      );
      clear();
      return;
    }

    toast.success(
      savedChunkCount === 1
        ? "Saved phrase and 1 practice chunk"
        : `Saved phrase and ${savedChunkCount} practice chunks`,
    );
    clear();
  }

  return {
    items,
    loading,
    suggestEmpty,
    visible: loading || items.length > 0 || suggestEmpty,
    clear,
    load,
    saveSelected,
  };
}