import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ResultCard } from "./result-card";
import type { TranslateResponse } from "@mindyourlanguage/shared";

const baseResult: TranslateResponse = {
  id: "r1",
  translation: "你好，很高兴认识你。",
  traditional: "你好，很高興認識你。",
  pinyin: "nǐ hǎo , hěn gāo xìng rèn shi nǐ .",
  detectedLang: "en",
  segments: [{ text: "你好", pinyin: "nǐ hǎo" }],
  dictionaryMatches: [],
};

const withNative: TranslateResponse = {
  ...baseResult,
  nativeAlternative: "你好，幸会。",
  register: "formal",
  nativeNote: "More concise greeting.",
};

describe("ResultCard register tabs", () => {
  it("renders both register tabs when a native alternative exists", () => {
    const html = renderToStaticMarkup(
      createElement(ResultCard, {
        result: withNative,
        characterSet: "simplified",
      }),
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain("Translation · 中性");
    expect(html).toContain("Native alternative · 书面");
    expect(html).toContain('data-testid="native-register-tab"');
  });

  it("renders no tabs without a native alternative", () => {
    const html = renderToStaticMarkup(
      createElement(ResultCard, {
        result: baseResult,
        characterSet: "simplified",
      }),
    );
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain('data-testid="result-translation"');
  });

  it("keeps the zh-to-en source block and spoken pinyin", () => {
    const html = renderToStaticMarkup(
      createElement(ResultCard, {
        result: { ...baseResult, spokenPinyin: "ní hǎo" },
        characterSet: "simplified",
        layout: "chinese-source",
        sourceText: "你好",
      }),
    );
    expect(html).toContain('data-testid="source-chinese-block"');
    expect(html).toContain('data-testid="spoken-pinyin"');
  });
});

describe("ResultCard footer", () => {
  const source = readFileSync(
    new URL("./result-card.tsx", import.meta.url),
    "utf8",
  );

  it("offers Play plus a playback-speed dropdown (0.5x / 0.75x / 1x, default 0.75x)", () => {
    expect(source).toContain('aria-label="Playback speed"');
    expect(source).toContain('data-testid="playback-speed-trigger"');
    expect(source).toContain("const SPEECH_RATES = [0.5, 0.75, 1] as const");
    expect(source).toContain("const DEFAULT_SPEECH_RATE = 0.75");
    expect(source).toContain("setPlaybackRate(rate)");
    expect(source).toContain("aria-label={`Play at ${rate} speed`}");
    expect(source).toContain("data-testid={`playback-speed-${rate}`}");
    expect(source).not.toContain("Play Mainland");
    expect(source).not.toContain("Play Taiwan");
    expect(source).not.toContain("ShadowingPlayer");
  });

  it("renders the speed dropdown trigger with the default rate", () => {
    const html = renderToStaticMarkup(
      createElement(ResultCard, {
        result: baseResult,
        characterSet: "simplified",
        isSaved: false,
        onToggleSave: () => {},
        showPlayButtons: true,
      }),
    );
    expect(html).toContain('data-testid="playback-speed-trigger"');
    expect(html).toContain('aria-label="Playback speed"');
    expect(html).toContain("0.75×");
  });

  it("keeps save and copy actions", () => {
    const html = renderToStaticMarkup(
      createElement(ResultCard, {
        result: baseResult,
        characterSet: "simplified",
        isSaved: false,
        onToggleSave: () => {},
      }),
    );
    expect(html).toContain("Save to phrasebook");
    expect(html).toContain("Copy");
  });

  it("shows the native note inside the native tab panel", () => {
    const html = renderToStaticMarkup(
      createElement(ResultCard, {
        result: withNative,
        characterSet: "simplified",
      }),
    );
    expect(html).toContain("你好，幸会。");
    expect(html).toContain("More concise greeting.");
  });
});

describe("ResultCard tab ARIA", () => {
  const source = readFileSync(
    new URL("./result-card.tsx", import.meta.url),
    "utf8",
  );

  it("wires tab id, aria-controls, and panel aria-labelledby in markup", () => {
    const html = renderToStaticMarkup(
      createElement(ResultCard, {
        result: withNative,
        characterSet: "simplified",
      }),
    );
    expect(html).toContain('id="result-tab-translation"');
    expect(html).toContain('aria-controls="result-panel-translation"');
    expect(html).toContain('id="result-tab-native"');
    expect(html).toContain('aria-controls="result-panel-native"');
    expect(html).toContain('id="result-panel-translation"');
    expect(html).toContain('aria-labelledby="result-tab-translation"');
    expect(html).toContain('id="result-panel-native"');
    expect(html).toContain('aria-labelledby="result-tab-native"');
  });

  it("uses roving tabIndex on tabs (selected 0, unselected -1)", () => {
    expect(source).toMatch(/tabIndex=\{tab === "translation" \? 0 : -1\}/);
    expect(source).toMatch(/tabIndex=\{tab === "native" \? 0 : -1\}/);
  });

  it("handles arrow keys on the tablist", () => {
    expect(source).toMatch(/role="tablist"[\s\S]*onKeyDown/);
  });

  it("does not render the native panel when register is missing", () => {
    const html = renderToStaticMarkup(
      createElement(ResultCard, {
        result: {
          ...baseResult,
          nativeAlternative: "你好，幸会。",
          nativeNote: "Orphan note.",
        },
        characterSet: "simplified",
      }),
    );
    expect(html).not.toContain('data-testid="native-panel"');
    expect(html).not.toContain("你好，幸会。");
  });
});
