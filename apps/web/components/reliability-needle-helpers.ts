import type { ReviewEvent } from "@mindyourlanguage/shared";
import type { WeeklyReliabilityBucket } from "@/lib/practice/reliability";

export interface SparklinePoint {
  x: number;
  y: number;
}

export function shouldShowEmptyNeedle(events: ReviewEvent[]): boolean {
  return events.length === 0;
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
