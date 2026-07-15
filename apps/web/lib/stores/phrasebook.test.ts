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
});
