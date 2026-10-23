"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PracticeDrillCard } from "@/components/practice-drill-card";
import { ReliabilityNeedle } from "@/components/reliability-needle";
import { SpeedDrillCard } from "@/components/speed-drill-card";
import { Button } from "@/components/ui/button";
import { getSpeedEntries } from "@/lib/practice/fluency";
import { getDueEntries } from "@/lib/practice/srs";
import {
  filterPhrasebookByTag,
  usePhrasebookStore,
} from "@/lib/stores/phrasebook";
import type { PhrasebookEntry, ReviewGrade, VoiceRegion } from "@mindyourlanguage/shared";

type DrillMode = "due" | "speed" | "all";

function emptyCopy(
  mode: DrillMode,
  items: PhrasebookEntry[],
  tagFilter: string,
): string {
  if (tagFilter.trim() && filterPhrasebookByTag(items, tagFilter).length === 0) {
    return "No phrases match that tag.";
  }
  if (mode === "due") {
    return "Nothing due today. Save phrases from Translate, or switch to All saved.";
  }
  if (mode === "all") {
    return "No phrasebook entries yet. Translate and save a phrase to start drilling.";
  }
  const speaking = items.some(
    (entry) =>
      entry.sourceLang === "en" &&
      entry.targetLang === "zh" &&
      entry.practiceStats?.fluency?.graduatedAt,
  );
  if (speaking) {
    return "Your phrases are in the speaking set. They come back here after about a month so they stay fast.";
  }
  return "Speed starts after you recall a phrase once. Grade a due card, then come back.";
}

export default function PracticePage() {
  const items = usePhrasebookStore((state) => state.items);
  const recordReview = usePhrasebookStore((state) => state.recordReview);
  const recordSpeedSession = usePhrasebookStore((state) => state.recordSpeedSession);
  const getDueCount = usePhrasebookStore((state) => state.getDueCount);
  const getSpeedCount = usePhrasebookStore((state) => state.getSpeedCount);

  const [mode, setMode] = useState<DrillMode>("due");
  const [tagFilter, setTagFilter] = useState("");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [speedRound, setSpeedRound] = useState(0);
  const [voiceRegion] = useState<VoiceRegion>("zh-CN");

  const queue = useMemo(() => {
    const tagged = filterPhrasebookByTag(items, tagFilter);
    if (mode === "speed") return getSpeedEntries(tagged);
    const base = mode === "due" ? getDueEntries(tagged) : tagged;
    return base.filter(
      (entry) => entry.sourceLang === "en" && entry.targetLang === "zh",
    );
  }, [items, mode, tagFilter]);

  const safeIndex = queue.length === 0 ? 0 : Math.min(index, queue.length - 1);
  const queued: PhrasebookEntry | undefined = queue[safeIndex];
  const pinned = pinnedId ? items.find((item) => item.id === pinnedId) : undefined;
  const current = mode === "speed" ? (pinned ?? queued) : queued;
  const dueCount = getDueCount();
  const speedCount = getSpeedCount();

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
    setPinnedId(null);
    setSpeedRound(0);
    resetCard();
  }

  function handleSpeedComplete() {
    if (!current) return;
    setPinnedId(current.id);
    recordSpeedSession(current.id);
  }

  function handleSpeedNext() {
    const id = pinnedId ?? current?.id;
    setPinnedId(null);
    setSpeedRound((round) => round + 1);
    if (!id) return;
    const position = queue.findIndex((entry) => entry.id === id);
    if (position === -1 || queue.length <= 1) return;
    setIndex((position + 1) % queue.length);
  }

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Practice
          </h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Recall phrases before they fade, then speed up the ones you already
            know until the card can rest.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="touch-target-sm max-sm:text-sm"
          asChild
        >
          <Link href="/">Translate</Link>
        </Button>
      </div>

      <ReliabilityNeedle />

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button
          type="button"
          variant={mode === "due" ? "default" : "outline"}
          className="touch-target-sm max-sm:flex-1 max-sm:text-sm"
          onClick={() => handleModeChange("due")}
          data-testid="mode-due"
        >
          Due today ({dueCount})
        </Button>
        <Button
          type="button"
          variant={mode === "speed" ? "default" : "outline"}
          className="touch-target-sm max-sm:flex-1 max-sm:text-sm"
          onClick={() => handleModeChange("speed")}
          data-testid="mode-speed"
        >
          Speed ({speedCount})
        </Button>
        <Button
          type="button"
          variant={mode === "all" ? "default" : "outline"}
          className="touch-target-sm max-sm:flex-1 max-sm:text-sm"
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
            setPinnedId(null);
            resetCard();
          }}
          placeholder="Filter by tag"
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8 sm:max-w-xs sm:flex-none sm:text-sm"
          data-testid="tag-filter"
        />
      </div>

      {current && mode === "speed" ? (
        <SpeedDrillCard
          key={`${current.id}-${speedRound}`}
          entry={current}
          onSessionComplete={handleSpeedComplete}
          onNext={handleSpeedNext}
          voiceRegion={voiceRegion}
        />
      ) : null}
      {current && mode !== "speed" ? (
        <PracticeDrillCard
          entry={current}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onGrade={handleGrade}
          voiceRegion={voiceRegion}
        />
      ) : null}
      {!current ? (
        <p className="text-sm text-muted-foreground" data-testid="practice-empty">
          {emptyCopy(mode, items, tagFilter)}
        </p>
      ) : null}
    </main>
  );
}
