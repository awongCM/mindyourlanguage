import { describe, expect, it } from "vitest";
import type { ReviewEvent } from "@mindyourlanguage/shared";
import {
  getSparklineSegments,
  shouldShowEmptyNeedle,
} from "./reliability-needle-helpers";

function event(reviewedAt: string): ReviewEvent {
  return {
    id: `event-${reviewedAt}`,
    phraseId: "phrase-1",
    mode: "self_grade",
    grade: "good",
    reviewedAt,
  };
}

describe("shouldShowEmptyNeedle", () => {
  it("only treats a needle as empty when there are no review events", () => {
    expect(shouldShowEmptyNeedle([])).toBe(true);
    expect(shouldShowEmptyNeedle([event("2026-07-01T12:00:00.000Z")])).toBe(
      false,
    );
  });
});

describe("getSparklineSegments", () => {
  it("breaks line segments across missing weekly buckets", () => {
    const segments = getSparklineSegments(
      [
        {
          weekStart: "2026-06-15T00:00:00.000Z",
          reliableCount: 1,
          total: 1,
          percent: 100,
        },
        {
          weekStart: "2026-06-22T00:00:00.000Z",
          reliableCount: 0,
          total: 0,
          percent: null,
        },
        {
          weekStart: "2026-06-29T00:00:00.000Z",
          reliableCount: 0,
          total: 1,
          percent: 0,
        },
      ],
      100,
      20,
    );

    expect(segments).toEqual([
      [{ x: 0, y: 2 }],
      [{ x: 100, y: 18 }],
    ]);
  });
});
