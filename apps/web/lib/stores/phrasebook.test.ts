import { beforeEach, describe, expect, it } from "vitest";
import {
  createPhrasebookEntry,
  entryMatchesSaved,
  filterPhrasebookByTag,
  isChineseAlreadySaved,
  phrasebookEntryKey,
  usePhrasebookStore,
} from "./phrasebook";
import { useReviewEventsStore } from "./review-events";

describe("phrasebook helpers", () => {
  it("dedupes by translation id when present", () => {
    const key = phrasebookEntryKey({
      translationId: "abc",
      sourceText: "Hello",
      translation: "你好",
    });
    expect(key).toBe("id:abc");
  });

  it("matches saved chinese by normalized translation text", () => {
    const saved = createPhrasebookEntry({
      translationId: null,
      sourceText: "to get to know",
      sourceLang: "en",
      targetLang: "zh",
      translation: "认识",
      characterSet: "simplified",
      dictionaryMatches: [],
      segments: [],
      tags: ["verb"],
    });

    expect(isChineseAlreadySaved([saved], " 认 识 ")).toBe(true);
    expect(isChineseAlreadySaved([saved], "认识")).toBe(true);
    expect(isChineseAlreadySaved([saved], "高兴")).toBe(false);
  });

  it("matches saved entries by translation id", () => {
    const saved = createPhrasebookEntry({
      translationId: "abc",
      sourceText: "Hello",
      sourceLang: "en",
      targetLang: "zh",
      translation: "你好",
      characterSet: "simplified",
      dictionaryMatches: [],
      segments: [],
    });

    expect(
      entryMatchesSaved(saved, {
        translationId: "abc",
        sourceText: "Different",
        translation: "Different",
      }),
    ).toBe(true);
  });

  it("filters entries by tag substring", () => {
    const items = [
      createPhrasebookEntry({
        translationId: "1",
        sourceText: "A",
        sourceLang: "en",
        targetLang: "zh",
        translation: "甲",
        characterSet: "simplified",
        dictionaryMatches: [],
        segments: [],
        tags: ["greeting"],
      }),
      createPhrasebookEntry({
        translationId: "2",
        sourceText: "B",
        sourceLang: "en",
        targetLang: "zh",
        translation: "乙",
        characterSet: "simplified",
        dictionaryMatches: [],
        segments: [],
        tags: ["travel"],
      }),
    ];

    expect(filterPhrasebookByTag(items, "gree")).toHaveLength(1);
    expect(filterPhrasebookByTag(items, "")).toHaveLength(2);
  });

  it("initializes practice stats on create", () => {
    const entry = createPhrasebookEntry({
      translationId: "abc",
      sourceText: "Hello",
      sourceLang: "en",
      targetLang: "zh",
      translation: "你好",
      characterSet: "simplified",
      dictionaryMatches: [],
      segments: [],
    });

    expect(entry.practiceStats?.easeFactor).toBe(2.5);
    expect(entry.practiceStats?.repetitions).toBe(0);
  });
});

describe("usePhrasebookStore", () => {
  beforeEach(() => {
    usePhrasebookStore.setState({ items: [] });
    useReviewEventsStore.setState({ events: [] });
  });

  it("dedupes on add and supports remove", () => {
    usePhrasebookStore.setState({ items: [] });

    const entry = createPhrasebookEntry({
      translationId: "abc",
      sourceText: "Hello",
      sourceLang: "en",
      targetLang: "zh",
      translation: "你好",
      characterSet: "simplified",
      dictionaryMatches: [],
      segments: [],
    });

    usePhrasebookStore.getState().add(entry);
    usePhrasebookStore.getState().add({
      ...entry,
      id: "other-id",
      translation: "嗨",
    });

    expect(usePhrasebookStore.getState().items).toHaveLength(1);
    expect(usePhrasebookStore.getState().items[0].translation).toBe("嗨");
    expect(
      usePhrasebookStore.getState().isSaved({
        translationId: "abc",
        sourceText: "Hello",
        translation: "你好",
      }),
    ).toBe(true);

    const saved = usePhrasebookStore.getState().items[0];
    usePhrasebookStore.getState().remove(saved.id);
    expect(usePhrasebookStore.getState().items).toHaveLength(0);
  });

  it("records reviews and updates due count", () => {
    usePhrasebookStore.setState({ items: [] });
    const now = new Date("2026-08-02T10:00:00.000Z");

    const entry = createPhrasebookEntry({
      translationId: "abc",
      sourceText: "Hello",
      sourceLang: "en",
      targetLang: "zh",
      translation: "你好",
      characterSet: "simplified",
      dictionaryMatches: [],
      segments: [],
      practiceStats: {
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        nextReviewAt: now.toISOString(),
      },
    });

    usePhrasebookStore.getState().add(entry);
    expect(usePhrasebookStore.getState().getDueCount(now)).toBe(1);

    usePhrasebookStore.getState().recordReview(entry.id, "good", now);
    const updated = usePhrasebookStore.getState().items[0];
    expect(updated.practiceStats?.repetitions).toBe(1);
    expect(updated.practiceStats?.intervalDays).toBe(1);
    expect(usePhrasebookStore.getState().getDueCount(now)).toBe(0);
    expect(
      usePhrasebookStore
        .getState()
        .getDueCount(new Date("2026-08-03T10:00:00.000Z")),
    ).toBe(1);
  });

  it("records a speed session without logging a review grade", () => {
    usePhrasebookStore.setState({ items: [] });
    useReviewEventsStore.setState({ events: [] });
    const now = new Date("2026-08-02T10:00:00.000Z");
    const entry = createPhrasebookEntry({
      translationId: "abc",
      sourceText: "Hello",
      sourceLang: "en",
      targetLang: "zh",
      translation: "你好",
      characterSet: "simplified",
      dictionaryMatches: [],
      segments: [],
      practiceStats: {
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 1,
        nextReviewAt: now.toISOString(),
      },
    });

    usePhrasebookStore.getState().add(entry);
    usePhrasebookStore.getState().recordSpeedSession(entry.id, now);

    const updated = usePhrasebookStore.getState().items[0];
    expect(updated.practiceStats?.fluency?.fastDays).toEqual(["2026-08-02"]);
    expect(updated.practiceStats?.repetitions).toBe(1);
    expect(usePhrasebookStore.getState().getSpeedCount(now)).toBe(1);
    expect(useReviewEventsStore.getState().events).toHaveLength(0);
  });

  it("counts an entry that is both due and speed-ready once", () => {
    usePhrasebookStore.setState({ items: [] });
    const now = new Date("2026-08-02T10:00:00.000Z");
    const make = (translationId: string, repetitions: number) =>
      createPhrasebookEntry({
        translationId,
        sourceText: `Hello ${translationId}`,
        sourceLang: "en",
        targetLang: "zh",
        translation: `你好${translationId}`,
        characterSet: "simplified",
        dictionaryMatches: [],
        segments: [],
        practiceStats: {
          easeFactor: 2.5,
          intervalDays: 0,
          repetitions,
          nextReviewAt: now.toISOString(),
        },
      });

    usePhrasebookStore.getState().add(make("a", 1)); // due and speed-ready
    usePhrasebookStore.getState().add(make("b", 0)); // due only

    const state = usePhrasebookStore.getState();
    expect(state.getDueCount(now)).toBe(2);
    expect(state.getSpeedCount(now)).toBe(1);
    expect(state.getPracticeCount(now)).toBe(2);
  });

  it("appends a review event when grading", () => {
    const entry = createPhrasebookEntry({
      translationId: "abc",
      sourceText: "Hello",
      sourceLang: "en",
      targetLang: "zh",
      translation: "你好",
      characterSet: "simplified",
      dictionaryMatches: [],
      segments: [],
    });
    const now = new Date("2026-08-06T12:00:00.000Z");
    usePhrasebookStore.setState({ items: [entry] });

    usePhrasebookStore.getState().recordReview(entry.id, "good", now);

    const events = useReviewEventsStore.getState().events;
    expect(events).toHaveLength(1);
    expect(events[0]?.phraseId).toBe(entry.id);
    expect(events[0]?.grade).toBe("good");
    expect(events[0]?.mode).toBe("self_grade");
    expect(events[0]?.reviewedAt).toBe("2026-08-06T12:00:00.000Z");
  });

  it("preserves parentId on create and cascade-removes children", () => {
    usePhrasebookStore.setState({ items: [] });
    const parent = createPhrasebookEntry({
      translationId: null,
      sourceText: "Long",
      sourceLang: "en",
      targetLang: "zh",
      translation: "很长的句子用来测试。",
      characterSet: "simplified",
      dictionaryMatches: [],
      segments: [],
    });
    const child = createPhrasebookEntry({
      translationId: null,
      sourceText: "Bit",
      sourceLang: "en",
      targetLang: "zh",
      translation: "一句",
      characterSet: "simplified",
      dictionaryMatches: [],
      segments: [],
      parentId: parent.id,
    });
    expect(child.parentId).toBe(parent.id);

    usePhrasebookStore.getState().add(parent);
    usePhrasebookStore.getState().add(child);
    usePhrasebookStore.getState().remove(parent.id);
    expect(usePhrasebookStore.getState().items).toHaveLength(0);
  });
});
