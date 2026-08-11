import type { ReviewEvent } from "@mindyourlanguage/shared";
import type {
  ReliabilityWindow,
  WeeklyReliabilityBucket,
} from "@/lib/practice/reliability";

export interface SparklinePoint {
  x: number;
  y: number;
}

export function shouldShowEmptyNeedle(events: ReviewEvent[]): boolean {
  return events.length === 0;
}

export function getSevenDayHero(sevenDay: ReliabilityWindow): string {
  if (sevenDay.total === 0) {
    return "No reviews this week";
  }
  if (sevenDay.buildingSignal) {
    return "Building signal…";
  }
  return `${sevenDay.percent}%`;
}

export function getSevenDaySubline(sevenDay: ReliabilityWindow): string {
  if (sevenDay.total === 0) {
    return "No reviews in the last 7 days";
  }
  return `${sevenDay.reliableCount} of ${sevenDay.total} reviews reliable · last 7 days`;
}

export function getReliabilityLiveSummary(
  sevenDay: ReliabilityWindow,
  thirtyDay: ReliabilityWindow,
): string {
  const thirty =
    thirtyDay.percent == null ? "—" : `${thirtyDay.percent}%`;
  return `7-day production reliability: ${getSevenDayHero(sevenDay)}. ${getSevenDaySubline(sevenDay)}. 30-day: ${thirty}. Based on self-grades.`;
}

export function getSparklineSegments(
  weeks: WeeklyReliabilityBucket[],
  width: number,
  height: number,
): SparklinePoint[][] {
  const segments: SparklinePoint[][] = [];
  let currentSegment: SparklinePoint[] = [];

  weeks.forEach((week, index) => {
    if (week.percent == null) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
      return;
    }

    const x = (index / Math.max(weeks.length - 1, 1)) * width;
    const y = height - 2 - (week.percent / 100) * (height - 4);
    currentSegment.push({ x, y });
  });

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}
