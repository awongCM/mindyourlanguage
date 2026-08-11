import { describe, expect, it } from "vitest";
import type { ReviewEvent } from "@mindyourlanguage/shared";
import {
  BUILDING_SIGNAL_MIN_REVIEWS,
  computeReliability,
  filterEventsInWindow,
  getReliabilitySummary,
  getWeeklyReliability,
  isReliableGrade,
} from "./reliability";

function event(
  partial: Partial<ReviewEvent> & Pick<ReviewEvent, "grade" | "reviewedAt">,
): ReviewEvent {
  return {
    id: partial.id ?? `e-${partial.reviewedAt}-${partial.grade}`,
    phraseId: partial.phraseId ?? "p1",
    mode: partial.mode ?? "self_grade",
    grade: partial.grade,
    reviewedAt: partial.reviewedAt,
  };
}

describe("isReliableGrade", () => {
  it("treats good and easy as reliable", () => {
    expect(isReliableGrade("good")).toBe(true);
    expect(isReliableGrade("easy")).toBe(true);
    expect(isReliableGrade("hard")).toBe(false);
    expect(isReliableGrade("again")).toBe(false);
  });
});

describe("filterEventsInWindow", () => {
  it("includes only events within windowDays", () => {
    const now = new Date("2026-08-06T12:00:00.000Z");
    const events = [
      event({ grade: "good", reviewedAt: "2026-08-05T12:00:00.000Z" }),
      event({ grade: "again", reviewedAt: "2026-07-20T12:00:00.000Z" }),
    ];
    expect(filterEventsInWindow(events, 7, now)).toHaveLength(1);
    expect(filterEventsInWindow(events, 30, now)).toHaveLength(2);
  });
});

describe("computeReliability", () => {
  it("returns null percent when empty", () => {
    expect(computeReliability([])).toEqual({
      reliableCount: 0,
      total: 0,
      percent: null,
    });
  });

  it("counts good+easy over total", () => {
    const events = [
      event({ grade: "good", reviewedAt: "2026-08-01T00:00:00.000Z" }),
      event({ grade: "easy", reviewedAt: "2026-08-02T00:00:00.000Z" }),
      event({ grade: "hard", reviewedAt: "2026-08-03T00:00:00.000Z" }),
      event({ grade: "again", reviewedAt: "2026-08-04T00:00:00.000Z" }),
    ];
    expect(computeReliability(events)).toEqual({
      reliableCount: 2,
      total: 4,
      percent: 50,
    });
  });
});

describe("getReliabilitySummary", () => {
  it("flags buildingSignal when 7d total is below threshold", () => {
    const now = new Date("2026-08-06T12:00:00.000Z");
    const events = Array.from({ length: BUILDING_SIGNAL_MIN_REVIEWS - 1 }, (_, i) =>
      event({
        grade: "good",
        reviewedAt: `2026-08-0${i + 1}T12:00:00.000Z`,
      }),
    );
    const summary = getReliabilitySummary(events, now);
    expect(summary.sevenDay.total).toBe(4);
    expect(summary.sevenDay.buildingSignal).toBe(true);
    expect(summary.sevenDay.percent).toBe(100);
  });

  it("clears buildingSignal at threshold", () => {
    const now = new Date("2026-08-06T12:00:00.000Z");
    const events = Array.from({ length: BUILDING_SIGNAL_MIN_REVIEWS }, (_, i) =>
      event({
        grade: i % 2 === 0 ? "good" : "again",
        reviewedAt: `2026-08-0${i + 1}T12:00:00.000Z`,
      }),
    );
    const summary = getReliabilitySummary(events, now);
    expect(summary.sevenDay.buildingSignal).toBe(false);
    expect(summary.sevenDay.total).toBe(5);
  });
});

describe("getWeeklyReliability", () => {
  it("returns 8 oldest-first ISO weeks with null percent for empty buckets", () => {
    const now = new Date("2026-08-06T12:00:00.000Z");
    const weeks = getWeeklyReliability(
      [
        event({ grade: "good", reviewedAt: "2026-08-05T12:00:00.000Z" }),
        event({ grade: "again", reviewedAt: "2026-07-28T12:00:00.000Z" }),
      ],
      8,
      now,
    );
    expect(weeks).toHaveLength(8);
    for (let i = 1; i < weeks.length; i += 1) {
      expect(new Date(weeks[i]!.weekStart).getTime()).toBeGreaterThan(
        new Date(weeks[i - 1]!.weekStart).getTime(),
      );
    }
    const emptyWeeks = weeks.filter((w) => w.total === 0);
    expect(emptyWeeks.length).toBeGreaterThan(0);
    expect(emptyWeeks.every((w) => w.percent === null)).toBe(true);
    const dataWeeks = weeks.filter((w) => w.total > 0);
    expect(dataWeeks).toHaveLength(2);
    expect(dataWeeks.every((w) => w.percent !== null)).toBe(true);
  });
});
