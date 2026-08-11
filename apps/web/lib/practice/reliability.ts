import type { ReviewEvent, ReviewGrade } from "@mindyourlanguage/shared";

export const BUILDING_SIGNAL_MIN_REVIEWS = 5;

export interface ReliabilityCounts {
  reliableCount: number;
  total: number;
  percent: number | null;
}

export interface ReliabilityWindow extends ReliabilityCounts {
  buildingSignal: boolean;
}

export interface WeeklyReliabilityBucket extends ReliabilityCounts {
  weekStart: string;
}

export function isReliableGrade(grade: ReviewGrade): boolean {
  return grade === "good" || grade === "easy";
}

export function filterEventsInWindow(
  events: ReviewEvent[],
  windowDays: number,
  now: Date = new Date(),
): ReviewEvent[] {
  const end = now.getTime();
  const start = end - windowDays * 24 * 60 * 60 * 1000;
  return events.filter((event) => {
    const t = new Date(event.reviewedAt).getTime();
    return t >= start && t <= end;
  });
}

export function computeReliability(events: ReviewEvent[]): ReliabilityCounts {
  const total = events.length;
  if (total === 0) {
    return { reliableCount: 0, total: 0, percent: null };
  }
  const reliableCount = events.filter((e) => isReliableGrade(e.grade)).length;
  return {
    reliableCount,
    total,
    percent: Math.round((reliableCount / total) * 100),
  };
}

function startOfUtcIsoWeek(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getWeeklyReliability(
  events: ReviewEvent[],
  weekCount = 8,
  now: Date = new Date(),
): WeeklyReliabilityBucket[] {
  const currentWeekStart = startOfUtcIsoWeek(now);
  const buckets: WeeklyReliabilityBucket[] = [];

  for (let i = weekCount - 1; i >= 0; i -= 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const inWeek = events.filter((event) => {
      const t = new Date(event.reviewedAt).getTime();
      return t >= weekStart.getTime() && t < weekEnd.getTime();
    });

    buckets.push({
      weekStart: weekStart.toISOString(),
      ...computeReliability(inWeek),
    });
  }

  return buckets;
}

function toWindow(events: ReviewEvent[]): ReliabilityWindow {
  const counts = computeReliability(events);
  return {
    ...counts,
    buildingSignal:
      counts.total > 0 && counts.total < BUILDING_SIGNAL_MIN_REVIEWS,
  };
}

export function getReliabilitySummary(
  events: ReviewEvent[],
  now: Date = new Date(),
): {
  sevenDay: ReliabilityWindow;
  thirtyDay: ReliabilityWindow;
  weekly: WeeklyReliabilityBucket[];
} {
  return {
    sevenDay: toWindow(filterEventsInWindow(events, 7, now)),
    thirtyDay: toWindow(filterEventsInWindow(events, 30, now)),
    weekly: getWeeklyReliability(events, 8, now),
  };
}
