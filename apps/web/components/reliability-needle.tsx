"use client";

import { useEffect, useMemo } from "react";
import {
  getReliabilitySummary,
  type WeeklyReliabilityBucket,
} from "@/lib/practice/reliability";
import { usePhrasebookStore } from "@/lib/stores/phrasebook";
import { usePhrasebookHydrated } from "@/lib/stores/use-phrasebook-hydrated";
import { useReviewEventsStore } from "@/lib/stores/review-events";
import {
  getReliabilityLiveSummary,
  getSevenDayHero,
  getSevenDaySubline,
  getSparklineSegments,
  shouldShowEmptyNeedle,
} from "./reliability-needle-helpers";

function Sparkline({ weeks }: { weeks: WeeklyReliabilityBucket[] }) {
  const width = 160;
  const height = 28;
  const segments = getSparklineSegments(weeks, width, height);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="text-foreground/70"
    >
      {segments.map((segment, index) => (
        <polyline
          key={index}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          points={segment.map((point) => `${point.x},${point.y}`).join(" ")}
        />
      ))}
      {segments.flat().map((point, index) => (
        <circle
          key={`point-${index}`}
          cx={point.x}
          cy={point.y}
          r="1.5"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

function StatTiles({
  speedCount,
  dueCount,
  savedCount,
}: {
  speedCount: number;
  dueCount: number;
  savedCount: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Practice counts">
      <div
        data-testid="stat-speed"
        className="rounded-lg bg-card px-3 py-2"
      >
        <p className="text-label-sm text-muted-foreground">Speed</p>
        <p className="text-title-md tabular-nums text-foreground">
          {speedCount}
        </p>
      </div>
      <div data-testid="stat-due" className="rounded-lg bg-card px-3 py-2">
        <p className="text-label-sm text-muted-foreground">Due today</p>
        <p className="text-title-md tabular-nums text-foreground">
          {dueCount}
        </p>
      </div>
      <div data-testid="stat-saved" className="rounded-lg bg-card px-3 py-2">
        <p className="text-label-sm text-muted-foreground">Saved</p>
        <p className="text-title-md tabular-nums text-foreground">
          {savedCount}
        </p>
      </div>
    </div>
  );
}

export function ReliabilityNeedle() {
  const events = useReviewEventsStore((state) => state.events);
  const hasHydrated = useReviewEventsStore((state) => state.hasHydrated);
  const setHasHydrated = useReviewEventsStore((state) => state.setHasHydrated);
  const phrasebookItems = usePhrasebookStore((state) => state.items);
  const getDueCount = usePhrasebookStore((state) => state.getDueCount);
  const getSpeedCount = usePhrasebookStore((state) => state.getSpeedCount);
  const phrasebookHydrated = usePhrasebookHydrated();
  const summary = useMemo(() => getReliabilitySummary(events), [events]);
  const { sevenDay, thirtyDay, weekly } = summary;
  const liveSummary = useMemo(
    () => getReliabilityLiveSummary(sevenDay, thirtyDay),
    [sevenDay, thirtyDay],
  );

  useEffect(() => {
    if (useReviewEventsStore.persist.hasHydrated()) {
      setHasHydrated(true);
    }
    return useReviewEventsStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });
  }, [setHasHydrated]);

  if (!hasHydrated) {
    return (
      <section
        data-testid="reliability-needle"
        aria-busy="true"
        className="rounded-lg border border-border/60 px-4 py-3"
      >
        <p className="text-sm text-muted-foreground">Loading progress…</p>
      </section>
    );
  }

  const tiles = phrasebookHydrated ? (
    <StatTiles
      speedCount={getSpeedCount()}
      dueCount={getDueCount()}
      savedCount={phrasebookItems.length}
    />
  ) : null;

  if (shouldShowEmptyNeedle(events)) {
    return (
      <section
        data-testid="reliability-needle"
        className="flex flex-col gap-3 rounded-lg border border-border/60 px-4 py-3"
      >
        <div>
          <p className="text-sm text-muted-foreground">
            Practice a few due phrases to unlock your needle.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Based on self-grades
          </p>
        </div>
        {tiles}
      </section>
    );
  }

  const hero = getSevenDayHero(sevenDay);
  const subline = getSevenDaySubline(sevenDay);

  return (
    <section
      data-testid="reliability-needle"
      className="flex flex-col gap-3 rounded-lg border border-border/60 px-4 py-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex flex-col gap-1"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="sr-only">{liveSummary}</p>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            7-day production reliability
          </p>
          <p
            data-testid="reliability-hero"
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            {hero}
          </p>
          <p className="text-sm text-muted-foreground">{subline}</p>
          <p className="text-xs text-muted-foreground">
            30-day:{" "}
            {thirtyDay.percent == null ? "—" : `${thirtyDay.percent}%`} · Based
            on self-grades
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <p className="text-xs text-muted-foreground">Last 8 weeks</p>
          <Sparkline weeks={weekly} />
        </div>
      </div>
      {tiles}
    </section>
  );
}
