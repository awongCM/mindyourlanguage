"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PracticeDrillCard } from "@/components/practice-drill-card";
import { Button } from "@/components/ui/button";
import { getDueEntries } from "@/lib/practice/srs";
import {
  filterPhrasebookByTag,
  usePhrasebookStore,
} from "@/lib/stores/phrasebook";
import type { PhrasebookEntry, ReviewGrade, VoiceRegion } from "@mindyourlanguage/shared";

type DrillMode = "due" | "all";

export default function PracticePage() {
  const items = usePhrasebookStore((state) => state.items);
  const recordReview = usePhrasebookStore((state) => state.recordReview);
  const getDueCount = usePhrasebookStore((state) => state.getDueCount);

  const [mode, setMode] = useState<DrillMode>("due");
  const [tagFilter, setTagFilter] = useState("");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [voiceRegion] = useState<VoiceRegion>("zh-CN");

  const queue = useMemo(() => {
    const tagged = filterPhrasebookByTag(items, tagFilter);
    const base = mode === "due" ? getDueEntries(tagged) : tagged;
    return base.filter(
      (entry) => entry.sourceLang === "en" && entry.targetLang === "zh",
    );
  }, [items, mode, tagFilter]);

  const safeIndex = queue.length === 0 ? 0 : Math.min(index, queue.length - 1);
  const current: PhrasebookEntry | undefined = queue[safeIndex];
  const dueCount = getDueCount();

  function resetCard() {
    setRevealed(false);
  }

  function handleGrade(grade: ReviewGrade) {
    if (!current) return;
    recordReview(current.id, grade);
    resetCard();
    if (mode === "all") {
      setIndex((value) => {
        if (queue.length <= 1) return 0;
        return (value + 1) % queue.length;
      });
    }
    // Due mode: graded card leaves the queue; keep index so the next due shifts in.
  }

  function handleModeChange(next: DrillMode) {
    setMode(next);
    setIndex(0);
    resetCard();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Practice
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drill your phrasebook with active recall and spaced review.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/">Translate</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant={mode === "due" ? "default" : "outline"}
          onClick={() => handleModeChange("due")}
          data-testid="mode-due"
        >
          Due today ({dueCount})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "all" ? "default" : "outline"}
          onClick={() => handleModeChange("all")}
          data-testid="mode-all"
        >
          All saved ({items.length})
        </Button>
        <input
          value={tagFilter}
          onChange={(event) => {
            setTagFilter(event.target.value);
            setIndex(0);
            resetCard();
          }}
          placeholder="Filter by tag"
          className="h-8 max-w-xs rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          data-testid="tag-filter"
        />
      </div>

      {current ? (
        <PracticeDrillCard
          entry={current}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onGrade={handleGrade}
          voiceRegion={voiceRegion}
        />
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="practice-empty">
          {mode === "due"
            ? "Nothing due today. Save phrases from Translate, or switch to All saved."
            : "No phrasebook entries yet. Translate and save a phrase to start drilling."}
        </p>
      )}
    </main>
  );
}
