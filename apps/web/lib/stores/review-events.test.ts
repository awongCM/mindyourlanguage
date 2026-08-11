import { beforeEach, describe, expect, it } from "vitest";
import {
  REVIEW_EVENTS_MAX,
  REVIEW_EVENTS_STORAGE_KEY,
  useReviewEventsStore,
} from "./review-events";

describe("review events store", () => {
  beforeEach(() => {
    useReviewEventsStore.setState({ events: [] });
    useReviewEventsStore.persist?.clearStorage?.();
  });

  it("uses the stable localStorage key", () => {
    expect(REVIEW_EVENTS_STORAGE_KEY).toBe("myl-review-events");
  });

  it("appends newest first with self_grade mode", () => {
    useReviewEventsStore.getState().append({
      phraseId: "p1",
      grade: "good",
      reviewedAt: "2026-08-06T10:00:00.000Z",
    });
    useReviewEventsStore.getState().append({
      phraseId: "p1",
      grade: "again",
      reviewedAt: "2026-08-06T11:00:00.000Z",
    });

    const events = useReviewEventsStore.getState().events;
    expect(events).toHaveLength(2);
    expect(events[0]?.grade).toBe("again");
    expect(events[0]?.mode).toBe("self_grade");
    expect(events[0]?.id).toBeTruthy();
  });

  it("caps at REVIEW_EVENTS_MAX", () => {
    for (let i = 0; i < REVIEW_EVENTS_MAX + 25; i += 1) {
      useReviewEventsStore.getState().append({
        phraseId: "p1",
        grade: "good",
        reviewedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      });
    }
    expect(useReviewEventsStore.getState().events).toHaveLength(
      REVIEW_EVENTS_MAX,
    );
  });
});
