import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhraseListCard } from "./phrase-list-card";

const base = {
  heading: "认识",
  pinyin: "rèn shi",
  gloss: "to meet; to get to know",
  onRestore: () => {},
  onRemove: () => {},
};

describe("PhraseListCard", () => {
  it("renders heading, pinyin, gloss, and a Remove action", () => {
    const html = renderToStaticMarkup(createElement(PhraseListCard, base));
    expect(html).toContain("认识");
    expect(html).toContain('lang="zh-Latn"');
    expect(html).toContain("rèn shi");
    expect(html).toContain("to meet; to get to know");
    expect(html).toContain("Remove");
  });

  it("renders optional meta line when provided", () => {
    const html = renderToStaticMarkup(
      createElement(PhraseListCard, { ...base, meta: "Tags: greeting" }),
    );
    expect(html).toContain("Tags: greeting");
  });

  it("omits the pinyin span when not provided", () => {
    const html = renderToStaticMarkup(
      createElement(PhraseListCard, {
        heading: base.heading,
        gloss: base.gloss,
        onRestore: base.onRestore,
        onRemove: base.onRemove,
      }),
    );
    expect(html).not.toContain('lang="zh-Latn"');
  });
});