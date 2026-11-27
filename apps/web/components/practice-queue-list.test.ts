// apps/web/components/practice-queue-list.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PracticeQueueList } from "./practice-queue-list";
import type { PhrasebookEntry } from "@mindyourlanguage/shared";

function entry(id: string, translation: string): PhrasebookEntry {
  return {
    id,
    translationId: `t-${id}`,
    sourceText: `source ${id}`,
    sourceLang: "en",
    targetLang: "zh",
    translation,
    characterSet: "simplified",
    dictionaryMatches: [],
    segments: [],
    tags: [],
    notes: "",
    createdAt: "2026-11-01T00:00:00.000Z",
  };
}

const entries = [entry("a", "你好"), entry("b", "谢谢"), entry("c", "再见")];

function renderList(overrides: Partial<Parameters<typeof PracticeQueueList>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PracticeQueueList, {
      entries,
      currentId: "b",
      speedReadyIds: new Set(["a", "b"]),
      dueIds: new Set(["b"]),
      onSelect: () => {},
      ...overrides,
    }),
  );
}

describe("PracticeQueueList", () => {
  it("lists every queue entry with zh title and source gloss", () => {
    const html = renderList();
    expect(html).toContain('data-testid="practice-queue-list"');
    expect(html).toContain("你好");
    expect(html).toContain("source c");
  });

  it("marks the current entry", () => {
    const html = renderList();
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('data-entry-id="b"');
  });

  it("renders status pills from the id sets", () => {
    const html = renderList();
    expect(html).toContain("Speed ready");
    expect(html).toContain("Due today");
    // entry c has neither status
    const rowC = html.slice(html.indexOf('data-entry-id="c"'));
    expect(rowC).not.toContain("Speed ready");
    expect(rowC).not.toContain("Due today");
  });

  it("uses sage for speed and amber for due", () => {
    const source = renderList();
    expect(source).toContain("bg-secondary");
    expect(source).toContain("bg-warning-container");
  });
});