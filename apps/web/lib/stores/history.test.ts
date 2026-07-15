import { beforeEach, describe, expect, it } from "vitest";
import { HISTORY_MAX, useHistoryStore } from "./history";
import { toTranslationRecord } from "../to-translation-record";

function makeRecord(id: string) {
  return toTranslationRecord({
    response: {
      id,
      translation: `translation-${id}`,
      detectedLang: "en",
      segments: [],
      dictionaryMatches: [],
    },
    sourceText: `source-${id}`,
    sourceLang: "en",
    targetLang: "zh",
    characterSet: "simplified",
  });
}

describe("useHistoryStore", () => {
  beforeEach(() => {
    useHistoryStore.setState({ items: [] });
  });

  it("prepends newest items", () => {
    useHistoryStore.getState().add(makeRecord("1"));
    useHistoryStore.getState().add(makeRecord("2"));

    const items = useHistoryStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("2");
    expect(items[1].id).toBe("1");
  });

  it(`caps history at ${HISTORY_MAX} items`, () => {
    for (let i = 0; i < HISTORY_MAX + 5; i += 1) {
      useHistoryStore.getState().add(makeRecord(String(i)));
    }

    const items = useHistoryStore.getState().items;
    expect(items).toHaveLength(HISTORY_MAX);
    expect(items[0].id).toBe(String(HISTORY_MAX + 4));
  });

  it("removes and clears items", () => {
    useHistoryStore.getState().add(makeRecord("1"));
    useHistoryStore.getState().add(makeRecord("2"));
    useHistoryStore.getState().remove("1");
    expect(useHistoryStore.getState().items).toHaveLength(1);

    useHistoryStore.getState().clear();
    expect(useHistoryStore.getState().items).toHaveLength(0);
  });
});
