// apps/web/components/translate/study-panel.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StudyPanel } from "./study-panel";
import type { DictionaryEntry } from "@mindyourlanguage/shared";

const entries: DictionaryEntry[] = [
  {
    simplified: "认识",
    traditional: "認識",
    pinyin: "ren4 shi5",
    definitions: ["to know (a person)"],
  },
];

function renderPanel(overrides: Partial<Parameters<typeof StudyPanel>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(StudyPanel, {
      availableTabs: ["dictionary"],
      tab: "dictionary",
      onTabChange: () => {},
      counts: { chunks: 0, learnables: 0, dictionary: 1 },
      characterSet: "simplified",
      chunksLoading: false,
      chunksSuggestEmpty: false,
      chunkItems: [],
      onSaveChunksSelected: () => {},
      onSaveFullOnly: () => {},
      onRetryChunks: () => {},
      learnablesLoading: false,
      learnableItems: [],
      onSaveLearnablesSelected: () => {},
      dictionaryEntries: entries,
      activeEntryKey: null,
      activeEntrySource: null,
      onActivateEntry: () => {},
      ...overrides,
    }),
  );
}

describe("StudyPanel tabs", () => {
  it("renders only the available tabs with counts", () => {
    const html = renderPanel();
    expect(html).toContain('data-testid="study-tab-dictionary"');
    expect(html).toContain("Dictionary (1)");
    expect(html).not.toContain("study-tab-chunks");
  });

  it("renders all three tabs when everything is available", () => {
    const html = renderPanel({
      availableTabs: ["chunks", "learnables", "dictionary"],
      counts: { chunks: 3, learnables: 2, dictionary: 1 },
    });
    expect(html).toContain("Chunks (3)");
    expect(html).toContain("New bits (2)");
    expect(html).toContain("Dictionary (1)");
  });
});

describe("StudyPanel dictionary cards", () => {
  it("renders anchor ids so the passage can scroll to a card", () => {
    const html = renderPanel();
    expect(html).toContain('id="dict-card-认识"');
    expect(html).toContain('data-testid="dictionary-card"');
    expect(html).toContain("to know (a person)");
  });

  it("flags the active card", () => {
    const html = renderPanel({ activeEntryKey: "认识" });
    expect(html).toContain('data-active="true"');
  });

  it("marks dictionary headwords as Chinese", () => {
    expect(renderPanel()).toContain('lang="zh"');
  });

  it("does not CSS-escape the card id used by getElementById", () => {
    const source = readFileSync(
      new URL("./study-panel.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("CSS.escape");
  });

  it("keeps traditional forms behind a toggle", () => {
    const html = renderPanel();
    expect(html).toContain("繁 Traditional");
    expect(html).not.toContain(">認識<");
  });
});

describe("StudyPanel chunk failure banner", () => {
  it("shows the amber banner with retry and save-full actions", () => {
    const html = renderPanel({
      availableTabs: ["chunks"],
      tab: "chunks",
      chunksSuggestEmpty: true,
    });
    expect(html).toContain('data-testid="practice-chunks-empty"');
    expect(html).toContain("Practice chunks unavailable");
    expect(html).toContain("Retry chunks");
    expect(html).toContain("Save full phrase");
  });

  it("uses the warning token pair", () => {
    const source = readFileSync(
      new URL("./study-panel.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("bg-warning-container");
    expect(source).toContain("text-on-warning-container");
  });
});
