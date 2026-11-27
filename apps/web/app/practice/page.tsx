"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { PracticeDrillCard } from "@/components/practice-drill-card";
import { PracticeQueueList } from "@/components/practice-queue-list";
import { ReliabilityNeedle } from "@/components/reliability-needle";
import { SpeedDrillCard } from "@/components/speed-drill-card";
import { parentChunkStatus } from "@/lib/practice/chunk-lock";
import { getSpeedEntries } from "@/lib/practice/fluency";
import {
  buildPracticeQueue,
  practiceEmptyMessage,
  resolvePracticeEntry,
  type DrillMode,
} from "@/lib/practice/practice-queue";
import { getDueEntries } from "@/lib/practice/srs";
import { usePhrasebookStore } from "@/lib/stores/phrasebook";
import { usePhrasebookHydrated } from "@/lib/stores/use-phrasebook-hydrated";
import type { ReviewGrade, VoiceRegion } from "@mindyourlanguage/shared";

const PRACTICE_PANEL_ID = "practice-panel";
const MODE_ORDER: readonly DrillMode[] = ["speed", "due", "all"];

function modeTabClass(active: boolean): string {
  return `rounded-full px-3 py-1.5 text-sm transition-colors duration-state-change ease-state-change ${
    active
      ? "bg-card font-medium text-foreground shadow-sm"
      : "text-muted-foreground"
  }`;
}

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
  const phrasebookHydrated = usePhrasebookHydrated();

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
  const dueCount = phrasebookHydrated ? getDueCount() : 0;
  const speedCount = phrasebookHydrated ? getSpeedCount() : 0;
  const savedCount = phrasebookHydrated ? items.length : 0;
  const chunkStatus =
    current && mode === "all" ? parentChunkStatus(items, current) : null;
  const speedReadyIds = useMemo(
    () => new Set(getSpeedEntries(items).map((entry) => entry.id)),
    [items],
  );
  const dueIds = useMemo(
    () => new Set(getDueEntries(items).map((entry) => entry.id)),
    [items],
  );
  const tabRefs = useRef<Record<DrillMode, HTMLButtonElement | null>>({
    speed: null,
    due: null,
    all: null,
  });

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

  function handleTabListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    const last = MODE_ORDER.length - 1;
    const currentIndex = MODE_ORDER.indexOf(mode);
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = last;
    else if (event.key === "ArrowRight") {
      nextIndex = currentIndex === last ? 0 : currentIndex + 1;
    } else {
      nextIndex = currentIndex === 0 ? last : currentIndex - 1;
    }
    const next = MODE_ORDER[nextIndex];
    if (next !== mode) handleModeChange(next);
    tabRefs.current[next]?.focus();
  }

  function handleQueueSelect(index: number) {
    setQueueIndex(index);
    setPinnedEntryId(null);
    resetRecallCard();
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
    <main className="mx-auto grid w-full min-w-0 max-w-7xl flex-1 gap-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Practice mode"
            className="flex flex-wrap gap-1 rounded-full bg-muted p-1"
            onKeyDown={handleTabListKeyDown}
          >
            <button
              ref={(node) => {
                tabRefs.current.speed = node;
              }}
              type="button"
              role="tab"
              id="practice-tab-speed"
              aria-selected={mode === "speed"}
              aria-controls={PRACTICE_PANEL_ID}
              tabIndex={mode === "speed" ? 0 : -1}
              data-testid="mode-speed"
              onClick={() => handleModeChange("speed")}
              className={modeTabClass(mode === "speed")}
            >
              Speed ({phrasebookHydrated ? speedCount : "…"})
            </button>
            <button
              ref={(node) => {
                tabRefs.current.due = node;
              }}
              type="button"
              role="tab"
              id="practice-tab-due"
              aria-selected={mode === "due"}
              aria-controls={PRACTICE_PANEL_ID}
              tabIndex={mode === "due" ? 0 : -1}
              data-testid="mode-due"
              onClick={() => handleModeChange("due")}
              className={modeTabClass(mode === "due")}
            >
              Due today ({phrasebookHydrated ? dueCount : "…"})
            </button>
            <button
              ref={(node) => {
                tabRefs.current.all = node;
              }}
              type="button"
              role="tab"
              id="practice-tab-all"
              aria-selected={mode === "all"}
              aria-controls={PRACTICE_PANEL_ID}
              tabIndex={mode === "all" ? 0 : -1}
              data-testid="mode-all"
              onClick={() => handleModeChange("all")}
              className={modeTabClass(mode === "all")}
            >
              All saved ({phrasebookHydrated ? savedCount : "…"})
            </button>
          </div>
          <input
            value={tagFilter}
            onChange={(event) => handleTagFilterChange(event.target.value)}
            placeholder="Filter by tag"
            aria-label="Filter by tag"
            className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8 sm:max-w-xs sm:flex-none sm:text-sm"
            data-testid="tag-filter"
          />
        </div>

        <div
          role="tabpanel"
          id={PRACTICE_PANEL_ID}
          aria-labelledby={`practice-tab-${mode}`}
          className="flex min-w-0 flex-col gap-6"
        >
          {current && mode === "speed" ? (
            <SpeedDrillCard
              key={`${current.id}-${speedRound}`}
              entry={current}
              onSessionComplete={handleSpeedComplete}
              onNext={handleSpeedNext}
              voiceRegion={voiceRegion}
            />
          ) : null}
          {chunkStatus ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="parent-chunk-status"
            >
              {chunkStatus}
            </p>
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
            <p
              className="text-sm text-muted-foreground"
              data-testid="practice-empty"
            >
              {practiceEmptyMessage(mode, items, tagFilter)}
            </p>
          ) : null}
          {mode === "all" && queue.length > 0 ? (
            <PracticeQueueList
              entries={queue}
              currentId={current?.id ?? null}
              speedReadyIds={speedReadyIds}
              dueIds={dueIds}
              onSelect={handleQueueSelect}
            />
          ) : null}
        </div>
      </div>

      <div className="min-w-0 lg:col-span-5">
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
          <ReliabilityNeedle />
        </div>
      </div>
    </main>
  );
}
