// apps/web/components/translate/reading-passage.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReadingPassage } from "./reading-passage";
import type { DictionaryEntry } from "@mindyourlanguage/shared";

const entries: DictionaryEntry[] = [
  {
    simplified: "认识",
    traditional: "認識",
    pinyin: "ren4 shi5",
    definitions: ["to know (a person)"],
  },
];

function renderPassage(overrides: Partial<Parameters<typeof ReadingPassage>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(ReadingPassage, {
      text: "你好，很高兴认识你。",
      pinyin: "nǐ hǎo , hěn gāo xìng rèn shi nǐ .",
      entries,
      activeEntryKey: null,
      onActivateEntry: () => {},
      ...overrides,
    }),
  );
}

describe("ReadingPassage", () => {
  it("is desktop-only", () => {
    expect(renderPassage()).toContain("hidden lg:");
  });

  it("renders dictionary matches as clickable tokens", () => {
    const html = renderPassage();
    expect(html).toContain('data-testid="passage-token"');
    expect(html).toContain('data-entry-key="认识"');
    expect(html).toContain(">认识</button>");
  });

  it("marks the active token as pressed", () => {
    const html = renderPassage({ activeEntryKey: "认识" });
    expect(html).toContain('aria-pressed="true"');
  });

  it("keeps pinyin behind a toggle chip", () => {
    const html = renderPassage();
    expect(html).toContain('data-testid="passage-pinyin-toggle"');
    expect(html).not.toContain("nǐ hǎo , hěn");
  });

  it("returns null for empty text", () => {
    expect(renderPassage({ text: "  " })).toBe("");
  });
});