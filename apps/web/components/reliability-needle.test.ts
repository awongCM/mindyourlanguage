import { describe, expect, it } from "vitest";
import type { ReviewEvent } from "@mindyourlanguage/shared";
import {
  getSevenDayHero,
  getSevenDaySubline,
  getSparklineSegments,
  shouldShowEmptyNeedle,
} from "./reliability-needle-helpers";
import type { ReliabilityWindow } from "@/lib/practice/reliability";

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

function window(partial: Partial<ReliabilityWindow>): ReliabilityWindow {
  return {
    reliableCount: 0,
    total: 0,
    percent: null,
    buildingSignal: false,
    ...partial,
  };
}

describe("getSevenDayHero", () => {
  it("distinguishes no recent reviews from building signal", () => {
    expect(getSevenDayHero(window({ total: 0, percent: null }))).toBe(
      "No reviews this week",
    );
    expect(
      getSevenDayHero(
        window({ total: 3, percent: 100, buildingSignal: true }),
      ),
    ).toBe("Building signal…");
    expect(
      getSevenDayHero(
        window({ total: 6, percent: 83, buildingSignal: false }),
      ),
    ).toBe("83%");
  });
});

describe("getSevenDaySubline", () => {
  it("uses idle copy when the 7-day window is empty", () => {
    expect(getSevenDaySubline(window({ total: 0 }))).toBe(
      "No reviews in the last 7 days",
    );
    expect(getSevenDaySubline(window({ total: 2, reliableCount: 1 }))).toBe(
      "1 of 2 reviews reliable · last 7 days",
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
