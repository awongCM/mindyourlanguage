"use client";

import { useMemo } from "react";
import {
  getReliabilitySummary,
  type WeeklyReliabilityBucket,
} from "@/lib/practice/reliability";
import { useReviewEventsStore } from "@/lib/stores/review-events";
import {
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

export function ReliabilityNeedle() {
  const events = useReviewEventsStore((state) => state.events);
  const summary = useMemo(() => getReliabilitySummary(events), [events]);
  const { sevenDay, thirtyDay, weekly } = summary;

  if (shouldShowEmptyNeedle(events)) {
    return (
      <section
        data-testid="reliability-needle"
        className="rounded-lg border border-border/60 px-4 py-3"
      >
        <p className="text-sm text-muted-foreground">
          Practice a few due phrases to unlock your needle.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Based on self-grades
        </p>
      </section>
    );
  }

  const hero =
    sevenDay.buildingSignal || sevenDay.percent == null
      ? "Building signal…"
      : `${sevenDay.percent}%`;

  return (
    <section
      data-testid="reliability-needle"
      className="flex flex-col gap-2 rounded-lg border border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          7-day production reliability
        </p>
        <p
          data-testid="reliability-hero"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          {hero}
        </p>
        <p className="text-sm text-muted-foreground">
          {sevenDay.reliableCount} of {sevenDay.total} reviews reliable · last
          7 days
        </p>
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
    </section>
  );
}
