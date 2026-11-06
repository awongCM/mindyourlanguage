import { beforeEach, describe, expect, it } from "vitest";
import {
  createLearnablePhrasebookEntry,
  saveNewLearnables,
} from "./learnables-to-phrasebook";
import { usePhrasebookStore } from "./stores/phrasebook";

const sample = {
  chinese: "认识",
  gloss: "to get to know",
  kind: "verb" as const,
  exampleChinese: "很高兴认识你。",
  exampleEnglish: "Nice to meet you.",
};

describe("createLearnablePhrasebookEntry", () => {
  it("maps a suggestion onto a phrasebook SRS card", () => {
    const entry = createLearnablePhrasebookEntry(sample, "simplified");

    expect(entry.translationId).toBeNull();
    expect(entry.sourceText).toBe("to get to know");
    expect(entry.translation).toBe("认识");
    expect(entry.tags).toEqual(["verb"]);
    expect(entry.notes).toBe("很高兴认识你。\nNice to meet you.");
    expect(entry.practiceStats?.repetitions).toBe(0);
  });
});

describe("saveNewLearnables", () => {
  beforeEach(() => {
    usePhrasebookStore.setState({ items: [] });
  });

  it("adds new cards and skips chinese already saved", () => {
    expect(saveNewLearnables([sample], "simplified")).toBe(1);
    expect(saveNewLearnables([sample], "simplified")).toBe(0);
    expect(usePhrasebookStore.getState().items).toHaveLength(1);
  });
});
