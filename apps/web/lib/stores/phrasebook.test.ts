import { describe, expect, it } from "vitest";
import {
  createPhrasebookEntry,
  entryMatchesSaved,
  filterPhrasebookByTag,
  phrasebookEntryKey,
  usePhrasebookStore,
} from "./phrasebook";

describe("phrasebook helpers", () => {
  it("dedupes by translation id when present", () => {
    const key = phrasebookEntryKey({
      translationId: "abc",
      sourceText: "Hello",
      translation: "你好",
    });
    expect(key).toBe("id:abc");
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
});
