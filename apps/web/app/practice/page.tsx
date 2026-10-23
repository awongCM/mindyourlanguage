"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PracticeDrillCard } from "@/components/practice-drill-card";
import { ReliabilityNeedle } from "@/components/reliability-needle";
import { SpeedDrillCard } from "@/components/speed-drill-card";
import { Button } from "@/components/ui/button";
import {
  buildPracticeQueue,
  practiceEmptyMessage,
  resolvePracticeEntry,
  type DrillMode,
} from "@/lib/practice/practice-queue";
import { usePhrasebookStore } from "@/lib/stores/phrasebook";
import type { ReviewGrade, VoiceRegion } from "@mindyourlanguage/shared";

export default function PracticePage() {
  const items = usePhrasebookStore((state) => state.items);
  const recordReview = usePhrasebookStore((state) => state.recordReview);
  const recordSpeedSession = usePhrasebookStore((state) => state.recordSpeedSession);
  const getDueCount = usePhrasebookStore((state) => state.getDueCount);
  const getSpeedCount = usePhrasebookStore((state) => state.getSpeedCount);

  const [mode, setMode] = useState<DrillMode>("due");
  const [tagFilter, setTagFilter] = useState("");
  const [queueIndex, setQueueIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  /** Keeps the speed success screen visible after the phrase leaves the queue. */
  const [pinnedEntryId, setPinnedEntryId] = useState<string | null>(null);
  const [speedRound, setSpeedRound] = useState(0);
  const [voiceRegion] = useState<VoiceRegion>("zh-CN");

  const queue = useMemo(
    () => buildPracticeQueue(items, mode, tagFilter),
    [items, mode, tagFilter],
  );

  const current = resolvePracticeEntry(
    mode,
    queue,
    queueIndex,
    items,
    pinnedEntryId,
  );
  const dueCount = getDueCount();
  const speedCount = getSpeedCount();

  function resetRecallCard() {
    setRevealed(false);
  }

  function resetSessionState() {
    setQueueIndex(0);
    setPinnedEntryId(null);
    setSpeedRound(0);
    resetRecallCard();
  }

  function handleGrade(grade: ReviewGrade) {
    if (!current) return;
    recordReview(current.id, grade);
    resetRecallCard();
    if (mode === "all" && queue.length > 1) {
      setQueueIndex((index) => (index + 1) % queue.length);
    }
  }

  function handleModeChange(next: DrillMode) {
    setMode(next);
    resetSessionState();
  }

  function handleTagFilterChange(next: string) {
    setTagFilter(next);
    resetSessionState();
  }

  function handleSpeedComplete() {
    if (!current) return;
    setPinnedEntryId(current.id);
    recordSpeedSession(current.id);
  }

  function handleSpeedNext() {
    const completedId = pinnedEntryId ?? current?.id;
    setPinnedEntryId(null);
    setSpeedRound((round) => round + 1);
    if (!completedId || queue.length <= 1) return;

    const completedIndex = queue.findIndex((entry) => entry.id === completedId);
    if (completedIndex === -1) return;
    setQueueIndex((completedIndex + 1) % queue.length);
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
          onChange={(event) => handleTagFilterChange(event.target.value)}
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
          {practiceEmptyMessage(mode, items, tagFilter)}
        </p>
      ) : null}
    </main>
  );
}
