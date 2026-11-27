# Scholarly Jade — Phase 3: Translate Workspace Implementation Plan

**Date:** 2026-11-27
**Spec:** `docs/superpowers/specs/2026-11-25-scholarly-jade-redesign-design.md` (Phase 3)
**Depends on:** Plan 1 (tokens — `text-reading-lg`, `text-title-md`, `text-label-sm`, `text-mono-sm`, `bg-warning-container`, `bg-surface-low`, `p-gutter-*` utilities), Plan 2 (app shell — page headers/drawers already removed from pages).
**Goal:** Restructure `/` into the two-column Stitch workspace: `ComposerCard`, register-tabbed `ResultCard`, desktop `ReadingPassage` with token↔dictionary sync, and a tabbed `StudyPanel` absorbing chunks/learnables/dictionary.

## Locked scope reminders

- Drop Try First + ComparisonPanel (UI only — `/api/practice/check` route and `lib/practice/check-attempt.ts` stay untouched).
- Drop `NativeAlternativeCard` and `GroundingPanel` as standalone components; their content moves into `ResultCard` tabs and the StudyPanel Dictionary tab.
- Keep `shadowing-player.tsx` — it is still used by the practice drill cards; it only leaves the `ResultCard`.
- Interactive passage is **desktop-only** (`hidden lg:…`). Mobile: single column, StudyPanel as a tabbed card below the result.
- ZH→EN keeps working: no register tabs (native alternative only exists EN→ZH), no passage, Dictionary tab still renders.

## Deliberate deviations (approved-pattern, documented)

- **Pinyin toggle reveals one whole-passage pinyin line**, not per-sentence pinyin lines — `result.pinyin` cannot be reliably re-aligned to sentences.
- **"Trad. & CL" toggle becomes a "繁 Traditional" toggle** — the dictionary has no classifier data; the toggle reveals traditional forms when they differ from simplified.
- **Chunks / New bits tabs keep the existing `PracticeChunksCard` / `LearnableSuggestionsCard` inner cards** (own headers/footers) inside the tab panels. Their restyle comes from tokens; rewriting them adds risk with no visual payoff inside a tab.

## Verification setup

All commands run from `apps/web`. House style: `renderToStaticMarkup` + `createElement` for component tests; fs source-assertion tests for wiring.

---

## Task 1: `lib/reading-passage.ts` — sentence splitting + dictionary token matching

Pure, synchronous, TDD-friendly. Tokenization matches both simplified and traditional surfaces so the passage works in either character set.

**Files:**
- Create: `apps/web/lib/reading-passage.ts`
- Test: `apps/web/lib/reading-passage.test.ts`

### Step 1: RED — write the failing test

```ts
// apps/web/lib/reading-passage.test.ts
import { describe, expect, it } from "vitest";
import {
  buildTermLookup,
  maxTermLength,
  splitIntoSentences,
  tokenizeSentence,
} from "./reading-passage";
import type { DictionaryEntry } from "@mindyourlanguage/shared";

const entries: DictionaryEntry[] = [
  { simplified: "认识", traditional: "認識", pinyin: "ren4 shi5", definitions: ["to know"] },
  { simplified: "很高兴", traditional: "很高興", pinyin: "hen3 gao1 xing4", definitions: ["very happy"] },
  { simplified: "很", traditional: "很", pinyin: "hen3", definitions: ["very"] },
];

describe("splitIntoSentences", () => {
  it("splits on Chinese terminators and keeps them attached", () => {
    expect(splitIntoSentences("你好。你好吗？")).toEqual(["你好。", "你好吗？"]);
  });

  it("splits on exclamation, semicolon and newlines", () => {
    expect(splitIntoSentences("走！快点；马上\n到了")).toEqual([
      "走！",
      "快点；",
      "马上",
      "到了",
    ]);
  });

  it("trims whitespace and drops empty segments", () => {
    expect(splitIntoSentences("  你好。  \n\n  ")).toEqual(["你好。"]);
    expect(splitIntoSentences("")).toEqual([]);
  });
});

describe("buildTermLookup", () => {
  it("indexes both simplified and traditional surfaces", () => {
    const lookup = buildTermLookup(entries);
    expect(lookup.get("认识")).toBe(0);
    expect(lookup.get("認識")).toBe(0);
    expect(lookup.get("很")).toBe(2);
  });
});

describe("maxTermLength", () => {
  it("returns the longest surface length", () => {
    expect(maxTermLength(buildTermLookup(entries))).toBe(3);
    expect(maxTermLength(new Map())).toBe(0);
  });
});

describe("tokenizeSentence", () => {
  const lookup = buildTermLookup(entries);
  const maxLen = maxTermLength(lookup);

  it("wraps dictionary terms as term tokens, longest match first", () => {
    const tokens = tokenizeSentence("很高兴认识你。", lookup, maxLen);
    expect(tokens).toEqual([
      { kind: "term", text: "很高兴", entryIndex: 1 },
      { kind: "term", text: "认识", entryIndex: 0 },
      { kind: "text", text: "你。" },
    ]);
  });

  it("prefers the longest match over a shorter overlapping one", () => {
    const tokens = tokenizeSentence("很高兴", lookup, maxLen);
    expect(tokens[0]).toEqual({ kind: "term", text: "很高兴", entryIndex: 1 });
  });

  it("matches the traditional surface of an entry", () => {
    const tokens = tokenizeSentence("認識你", lookup, maxLen);
    expect(tokens[0]).toEqual({ kind: "term", text: "認識", entryIndex: 0 });
  });

  it("emits plain text tokens when nothing matches", () => {
    expect(tokenizeSentence("hello", lookup, maxLen)).toEqual([
      { kind: "text", text: "hello" },
    ]);
  });

  it("returns no tokens for an empty sentence or empty lookup", () => {
    expect(tokenizeSentence("", lookup, maxLen)).toEqual([]);
    expect(tokenizeSentence("你好", new Map(), 0)).toEqual([
      { kind: "text", text: "你好" },
    ]);
  });
});
```

### Step 2: run to confirm failure

```bash
cd apps/web && npm test -- reading-passage
```

### Step 3: GREEN — implement

```ts
// apps/web/lib/reading-passage.ts
import type { DictionaryEntry } from "@mindyourlanguage/shared";

export interface PassageToken {
  kind: "text" | "term";
  text: string;
  /** Index into the entries array passed to buildTermLookup. Term tokens only. */
  entryIndex?: number;
}

const SENTENCE_END_CHARS = new Set([
  "。",
  "！",
  "？",
  "!",
  "?",
  "；",
  ";",
  "\n",
]);

/** Split a passage into trimmed sentences, keeping the terminator attached. */
export function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = "";
  for (const char of text) {
    if (SENTENCE_END_CHARS.has(char)) {
      const trimmed = (current + (char === "\n" ? "" : char)).trim();
      if (trimmed) sentences.push(trimmed);
      current = "";
    } else {
      current += char;
    }
  }
  const tail = current.trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/** Map every surface form (simplified + traditional) to its entry index. */
export function buildTermLookup(
  entries: DictionaryEntry[],
): Map<string, number> {
  const lookup = new Map<string, number>();
  entries.forEach((entry, index) => {
    if (entry.simplified && !lookup.has(entry.simplified)) {
      lookup.set(entry.simplified, index);
    }
    if (entry.traditional && !lookup.has(entry.traditional)) {
      lookup.set(entry.traditional, index);
    }
  });
  return lookup;
}

export function maxTermLength(lookup: Map<string, number>): number {
  let max = 0;
  for (const key of lookup.keys()) {
    if (key.length > max) max = key.length;
  }
  return max;
}

/**
 * Greedy longest-match scan. Dictionary matches become "term" tokens;
 * everything between them coalesces into "text" tokens.
 */
export function tokenizeSentence(
  sentence: string,
  lookup: Map<string, number>,
  maxLen: number,
): PassageToken[] {
  const tokens: PassageToken[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer) {
      tokens.push({ kind: "text", text: buffer });
      buffer = "";
    }
  };

  let index = 0;
  while (index < sentence.length) {
    let matched: string | null = null;
    if (maxLen > 0) {
      const upper = Math.min(maxLen, sentence.length - index);
      for (let len = upper; len >= 1; len -= 1) {
        const candidate = sentence.slice(index, index + len);
        if (lookup.has(candidate)) {
          matched = candidate;
          break;
        }
      }
    }
    if (matched !== null) {
      flush();
      tokens.push({
        kind: "term",
        text: matched,
        entryIndex: lookup.get(matched),
      });
      index += matched.length;
    } else {
      buffer += sentence[index];
      index += 1;
    }
  }
  flush();
  return tokens;
}
```

### Step 4: verify

```bash
cd apps/web && npm test -- reading-passage
```

Expected: 10 tests pass.

---

## Task 2: `ComposerCard` + segmented-pill `Toggles`

Wrap settings + form + native-alternative checkbox into one card. Restyle `Toggles` groups as sage-track segmented pills (active = jade fill).

**Files:**
- Create: `apps/web/components/translate/composer-card.tsx`
- Modify: `apps/web/components/toggles.tsx`
- Test: `apps/web/components/translate/composer-card.test.ts`

### Step 1: RED — failing structure test

```ts
// apps/web/components/translate/composer-card.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./composer-card.tsx", import.meta.url),
  "utf8",
);
const toggles = readFileSync(
  new URL("../toggles.tsx", import.meta.url),
  "utf8",
);

describe("ComposerCard structure", () => {
  it("composes Toggles, TranslatorForm and the native-alternative checkbox", () => {
    expect(source).toContain("<Toggles");
    expect(source).toContain("<TranslatorForm");
    expect(source).toContain("Native alternative");
  });

  it("hides the native-alternative checkbox unless EN to ZH", () => {
    expect(source).toContain("showNativeAlternative ? (");
  });

  it("renders inside a Card", () => {
    expect(source).toContain('from "@/components/ui/card"');
    expect(source).toContain("<Card");
  });

  it("never mentions Try First", () => {
    expect(source).not.toContain("TryFirst");
    expect(source).not.toContain("Try First");
  });
});

describe("Toggles segmented pills", () => {
  it("uses a rounded sage track", () => {
    expect(toggles).toContain("rounded-full bg-muted p-1");
  });

  it("fills the active segment with primary", () => {
    expect(toggles).toContain("data-[state=on]:bg-primary");
    expect(toggles).toContain("data-[state=on]:text-primary-foreground");
  });
});
```

### Step 2: run to confirm failure

```bash
cd apps/web && npm test -- composer-card
```

### Step 3: GREEN — implement

Rewrite `apps/web/components/toggles.tsx` (same props/behavior, new pill styling — keep the `aria-label`s and values; e2e clicks `getByRole('radio', { name: '繁體' })`):

```tsx
"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CharacterSet, VoiceRegion } from "@mindyourlanguage/shared";

interface TogglesProps {
  characterSet: CharacterSet;
  onCharacterSetChange: (v: CharacterSet) => void;
  voiceRegion: VoiceRegion;
  onVoiceRegionChange: (v: VoiceRegion) => void;
}

const GROUP_CLASS = "rounded-full bg-muted p-1";
const ITEM_CLASS =
  "rounded-full px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

export function Toggles({
  characterSet,
  onCharacterSetChange,
  voiceRegion,
  onVoiceRegionChange,
}: TogglesProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={characterSet}
        onValueChange={(value) => {
          if (value === "simplified" || value === "traditional") {
            onCharacterSetChange(value);
          }
        }}
        aria-label="Character set"
        className={GROUP_CLASS}
      >
        <ToggleGroupItem value="simplified" className={ITEM_CLASS}>
          简体
        </ToggleGroupItem>
        <ToggleGroupItem value="traditional" className={ITEM_CLASS}>
          繁體
        </ToggleGroupItem>
      </ToggleGroup>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={voiceRegion}
        onValueChange={(value) => {
          if (value === "zh-CN" || value === "zh-TW") {
            onVoiceRegionChange(value);
          }
        }}
        aria-label="Voice region"
        className={GROUP_CLASS}
      >
        <ToggleGroupItem value="zh-CN" className={ITEM_CLASS}>
          CN Voice
        </ToggleGroupItem>
        <ToggleGroupItem value="zh-TW" className={ITEM_CLASS}>
          TW Voice
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
```

Create `apps/web/components/translate/composer-card.tsx`:

```tsx
"use client";

import { Toggles } from "@/components/toggles";
import {
  TranslatorForm,
  type TranslateDirection,
} from "@/components/translator-form";
import { Card, CardContent } from "@/components/ui/card";
import type { CharacterSet, VoiceRegion } from "@mindyourlanguage/shared";

interface ComposerCardProps {
  characterSet: CharacterSet;
  onCharacterSetChange: (value: CharacterSet) => void;
  voiceRegion: VoiceRegion;
  onVoiceRegionChange: (value: VoiceRegion) => void;
  sourceText: string;
  onSourceTextChange: (text: string) => void;
  onSubmit: (text: string) => void;
  onClear: () => void;
  isLoading: boolean;
  direction: TranslateDirection;
  onDirectionChange: (direction: TranslateDirection) => void;
  showNativeAlternative: boolean;
  includeNativeAlternative: boolean;
  onIncludeNativeAlternativeChange: (value: boolean) => void;
}

export function ComposerCard({
  characterSet,
  onCharacterSetChange,
  voiceRegion,
  onVoiceRegionChange,
  sourceText,
  onSourceTextChange,
  onSubmit,
  onClear,
  isLoading,
  direction,
  onDirectionChange,
  showNativeAlternative,
  includeNativeAlternative,
  onIncludeNativeAlternativeChange,
}: ComposerCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <Toggles
          characterSet={characterSet}
          onCharacterSetChange={onCharacterSetChange}
          voiceRegion={voiceRegion}
          onVoiceRegionChange={onVoiceRegionChange}
        />
        <TranslatorForm
          sourceText={sourceText}
          onSourceTextChange={onSourceTextChange}
          onSubmit={onSubmit}
          onClear={onClear}
          isLoading={isLoading}
          direction={direction}
          onDirectionChange={onDirectionChange}
        />
        {showNativeAlternative ? (
          <label className="flex w-fit items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={includeNativeAlternative}
              onChange={(event) =>
                onIncludeNativeAlternativeChange(event.target.checked)
              }
              className="size-4 rounded border-foreground/20"
            />
            Native alternative
          </label>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

### Step 4: verify

```bash
cd apps/web && npm test -- composer-card
```

Expected: 6 tests pass.

---

## Task 3: `ResultCard` register tabs + consolidated footer

Absorb `NativeAlternativeCard` as a register tab; replace the Play Mainland / Play Taiwan / Stop trio + ShadowingPlayer with Play (jade, current `voiceRegion`), 0.75×, Save/Saved, Copy. Delete `native-alternative-card.tsx` and its test.

**Files:**
- Modify: `apps/web/components/result-card.tsx` (rewrite)
- Delete: `apps/web/components/native-alternative-card.tsx`, `apps/web/components/native-alternative-card.test.ts`
- Test: `apps/web/components/result-card.test.ts` (new)

### Step 1: RED — failing tests

```ts
// apps/web/components/result-card.test.ts
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

  it("offers Play at the current region plus a 0.75x button", () => {
    expect(source).toContain('aria-label="Play at 0.75 speed"');
    expect(source).toContain("{ rate: 0.75 }");
    expect(source).not.toContain("Play Mainland");
    expect(source).not.toContain("Play Taiwan");
    expect(source).not.toContain("ShadowingPlayer");
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
```

(`renderToStaticMarkup` renders the default tab = translation panel; the native panel markup is included but visually hidden — asserted via source text.)

### Step 2: run to confirm failure

```bash
cd apps/web && npm test -- result-card
```

### Step 3: GREEN — rewrite `apps/web/components/result-card.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { Bookmark, Copy, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { displayForCharacterSet } from "@/lib/characters";
import { registerLabel } from "@/lib/native-alternative-shared";
import { cancelSpeech, speakChinese } from "@/lib/speech";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  CharacterSet,
  TranslateResponse,
  VoiceRegion,
} from "@mindyourlanguage/shared";

export type ResultLayout = "chinese-target" | "chinese-source";

interface ResultCardProps {
  result: TranslateResponse;
  characterSet: CharacterSet;
  layout?: ResultLayout;
  sourceText?: string;
  showPlayButtons?: boolean;
  voiceRegion?: VoiceRegion;
  isSaved?: boolean;
  onToggleSave?: () => void;
  phrasebookHint?: string;
}

function displayedChineseText(
  text: string,
  traditional: string | undefined,
  characterSet: CharacterSet,
): string {
  if (characterSet === "traditional" && traditional) {
    return traditional;
  }
  return text;
}

function displayedTranslation(
  result: TranslateResponse,
  characterSet: CharacterSet,
): string {
  return displayedChineseText(
    result.translation,
    result.traditional,
    characterSet,
  );
}

function PinyinBlock({ result }: { result: TranslateResponse }) {
  if (!result.pinyin) return null;

  return (
    <div className="flex flex-col gap-1 font-mono text-mono-sm text-muted-foreground">
      <p lang="zh-Latn">
        <span className="mr-2 font-medium text-foreground/70">
          Syllable pinyin
        </span>
        {result.pinyin}
      </p>
      {result.spokenPinyin ? (
        <p lang="zh-Latn" data-testid="spoken-pinyin">
          <span className="mr-2 font-medium text-foreground/70">
            Spoken pinyin
          </span>
          {result.spokenPinyin}
        </p>
      ) : null}
    </div>
  );
}

function SegmentList({
  segments,
}: {
  segments: TranslateResponse["segments"];
}) {
  if (segments.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Word segments">
      {segments.map((segment, index) => (
        <li
          key={`${segment.text}-${index}`}
          className="rounded-md bg-muted px-2 py-1 text-sm"
        >
          <span className="font-medium text-foreground">{segment.text}</span>
          {segment.pinyin ? (
            <span className="ml-1.5 font-mono text-mono-sm text-muted-foreground">
              {segment.pinyin}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

type RegisterTab = "translation" | "native";

export function ResultCard({
  result,
  characterSet,
  layout = "chinese-target",
  sourceText = "",
  showPlayButtons = false,
  voiceRegion = "zh-CN",
  isSaved = false,
  onToggleSave,
  phrasebookHint,
}: ResultCardProps) {
  const isChineseSource = layout === "chinese-source";
  const displayText = isChineseSource
    ? result.translation
    : displayedTranslation(result, characterSet);
  const chineseText = isChineseSource
    ? displayedChineseText(sourceText, result.traditional, characterSet)
    : displayText;
  const audioText = isChineseSource ? chineseText : displayText;

  const hasNative = Boolean(result.nativeAlternative && result.register);
  const [tab, setTab] = useState<RegisterTab>("translation");

  useEffect(() => {
    setTab("translation");
  }, [result.id]);

  useEffect(() => {
    return () => cancelSpeech();
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(displayText);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function play(text: string, rate?: number) {
    try {
      const { usedRegionFallback } = await speakChinese(text, voiceRegion, {
        ...(typeof rate === "number" ? { rate } : {}),
      });
      if (usedRegionFallback) {
        toast.info(
          voiceRegion === "zh-TW"
            ? "Taiwan voice unavailable — using the closest Chinese voice on this device."
            : "Mainland voice unavailable — using the closest Chinese voice on this device.",
        );
      }
    } catch {
      toast.error("Audio unavailable");
    }
  }

  const nativeText = result.nativeAlternative
    ? displayForCharacterSet(result.nativeAlternative, characterSet)
    : null;
  const playText = tab === "native" && nativeText ? nativeText : audioText;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        {hasNative ? (
          <div
            role="tablist"
            aria-label="Translation registers"
            className="flex w-fit gap-1 rounded-full bg-muted p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "translation"}
              onClick={() => setTab("translation")}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                tab === "translation"
                  ? "bg-card font-medium text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Translation · 中性
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "native"}
              onClick={() => setTab("native")}
              data-testid="native-register-tab"
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                tab === "native"
                  ? "bg-card font-medium text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Native alternative ·{" "}
              {registerLabel(result.register ?? "neutral")}
            </button>
          </div>
        ) : (
          <CardTitle>Translation</CardTitle>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Both panels stay mounted so state (and static markup) survives tab switches. */}
        {nativeText ? (
          <div
            role="tabpanel"
            data-testid="native-panel"
            className={tab === "native" ? "flex flex-col gap-3" : "hidden"}
          >
            <p className="break-anywhere text-reading-lg text-foreground">
              {nativeText}
            </p>
            {result.nativeNote ? (
              <p className="text-sm text-muted-foreground">
                {result.nativeNote}
              </p>
            ) : null}
          </div>
        ) : null}
        <div
          role="tabpanel"
          className={
            tab === "native" && nativeText ? "hidden" : "flex flex-col gap-4"
          }
        >
          <p
            data-testid="result-translation"
            className="break-anywhere text-reading-lg text-foreground"
          >
            {displayText}
          </p>

          {isChineseSource ? (
            <div
              className="flex flex-col gap-3 border-t border-border pt-4"
              data-testid="source-chinese-block"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Mandarin source
              </p>
              <p
                data-testid="source-chinese-text"
                className="break-anywhere text-reading-lg text-foreground"
              >
                {chineseText}
              </p>
              <PinyinBlock result={result} />
              <SegmentList segments={result.segments} />
            </div>
          ) : (
            <>
              <PinyinBlock result={result} />
              <SegmentList segments={result.segments} />
            </>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 max-sm:grid max-sm:grid-cols-2">
        {showPlayButtons ? (
          <>
            <Button
              type="button"
              className="touch-target-sm max-sm:text-sm"
              onClick={() => play(playText)}
            >
              <Play />
              Play
            </Button>
            <Button
              type="button"
              variant="outline"
              className="touch-target-sm max-sm:text-sm"
              aria-label="Play at 0.75 speed"
              onClick={() => play(playText, 0.75)}
            >
              0.75×
            </Button>
          </>
        ) : null}
        {onToggleSave ? (
          <Button
            type="button"
            variant={isSaved ? "secondary" : "outline"}
            className="touch-target-sm max-sm:text-sm"
            onClick={onToggleSave}
          >
            <Bookmark />
            {isSaved ? "Saved" : "Save to phrasebook"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="touch-target-sm max-sm:text-sm"
          onClick={handleCopy}
        >
          <Copy />
          Copy
        </Button>
        {phrasebookHint ? (
          <p className="basis-full text-sm text-muted-foreground">
            {phrasebookHint}
          </p>
        ) : null}
      </CardFooter>
    </Card>
  );
}
```

Note the footer no longer spans buttons across both mobile columns (`max-sm:col-span-2` removed) — four compact buttons fit the 2-col grid.

Delete the absorbed component:

```bash
rm apps/web/components/native-alternative-card.tsx apps/web/components/native-alternative-card.test.ts
```

### Step 4: verify

```bash
cd apps/web && npm test -- result-card
```

Expected: 6 tests pass. (`page.tsx` still imports `NativeAlternativeCard` — that is fixed in Task 6; run only this test file for now.)

---

## Task 4: `ReadingPassage` component (desktop-only, token sync)

**Files:**
- Create: `apps/web/components/translate/reading-passage.tsx`
- Test: `apps/web/components/translate/reading-passage.test.ts`

The passage is a controlled component: `activeEntryKey` / `onActivateEntry` live in `page.tsx` so the StudyPanel dictionary cards share the same state (bidirectional sync).

### Step 1: RED — failing tests

```ts
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
```

### Step 2: run to confirm failure

```bash
cd apps/web && npm test -- reading-passage
```

### Step 3: GREEN — implement

```tsx
// apps/web/components/translate/reading-passage.tsx
"use client";

import { useMemo, useState } from "react";
import {
  buildTermLookup,
  maxTermLength,
  splitIntoSentences,
  tokenizeSentence,
  type PassageToken,
} from "@/lib/reading-passage";
import type { DictionaryEntry } from "@mindyourlanguage/shared";

interface ReadingPassageProps {
  /** Displayed Chinese text (already adjusted for character set). */
  text: string;
  pinyin?: string;
  entries: DictionaryEntry[];
  activeEntryKey: string | null;
  onActivateEntry: (key: string) => void;
}

function Token({
  token,
  entries,
  activeEntryKey,
  onActivateEntry,
}: {
  token: PassageToken;
  entries: DictionaryEntry[];
  activeEntryKey: string | null;
  onActivateEntry: (key: string) => void;
}) {
  if (token.kind !== "term" || token.entryIndex === undefined) {
    return <span>{token.text}</span>;
  }
  const entry = entries[token.entryIndex];
  if (!entry) return <span>{token.text}</span>;
  const key = entry.simplified;
  const active = activeEntryKey === key;

  return (
    <button
      type="button"
      data-testid="passage-token"
      data-entry-key={key}
      aria-pressed={active}
      onClick={() => onActivateEntry(key)}
      className={`rounded-sm px-0.5 underline decoration-dotted underline-offset-4 transition-colors duration-state-change ease-state-change hover:bg-secondary/60 ${
        active ? "bg-secondary font-medium" : ""
      }`}
    >
      {token.text}
    </button>
  );
}

export function ReadingPassage({
  text,
  pinyin,
  entries,
  activeEntryKey,
  onActivateEntry,
}: ReadingPassageProps) {
  const [showPinyin, setShowPinyin] = useState(false);

  const sentences = useMemo(() => {
    const lookup = buildTermLookup(entries);
    const maxLen = maxTermLength(lookup);
    return splitIntoSentences(text).map((sentence) =>
      tokenizeSentence(sentence, lookup, maxLen),
    );
  }, [text, entries]);

  if (sentences.length === 0) return null;

  return (
    <section
      aria-label="Reading passage"
      data-testid="reading-passage"
      className="hidden rounded-lg border border-border bg-card p-gutter-md lg:flex lg:flex-col lg:gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title-md text-foreground">Read it back</h2>
        {pinyin ? (
          <button
            type="button"
            data-testid="passage-pinyin-toggle"
            aria-pressed={showPinyin}
            onClick={() => setShowPinyin((value) => !value)}
            className="rounded-full border border-border px-3 py-1 text-label-sm text-muted-foreground transition-colors duration-state-change ease-state-change hover:bg-muted aria-pressed:bg-secondary aria-pressed:text-foreground"
          >
            Pinyin
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        {sentences.map((tokens, sentenceIndex) => (
          <p key={sentenceIndex} className="text-reading-lg text-foreground">
            {tokens.map((token, tokenIndex) => (
              <Token
                key={tokenIndex}
                token={token}
                entries={entries}
                activeEntryKey={activeEntryKey}
                onActivateEntry={onActivateEntry}
              />
            ))}
          </p>
        ))}
      </div>
      {showPinyin && pinyin ? (
        <p
          lang="zh-Latn"
          className="border-t border-border pt-3 font-mono text-mono-sm text-muted-foreground"
          data-testid="passage-pinyin"
        >
          {pinyin}
        </p>
      ) : null}
    </section>
  );
}
```

### Step 4: verify

```bash
cd apps/web && npm test -- reading-passage
```

Expected: 5 component tests + 10 lib tests pass.

---

## Task 5: `StudyPanel` — tabbed right column + amber chunk-failure banner

Absorbs `GroundingPanel` (deleted). Dictionary cards share `activeEntryKey` with the passage; when activation comes from the passage, the matching card scrolls into view.

**Files:**
- Create: `apps/web/components/translate/study-panel.tsx`
- Delete: `apps/web/components/grounding-panel.tsx`, `apps/web/components/grounding-panel.test.ts`
- Test: `apps/web/components/translate/study-panel.test.ts`

### Step 1: RED — failing tests

```ts
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
```

### Step 2: run to confirm failure

```bash
cd apps/web && npm test -- study-panel
```

### Step 3: GREEN — implement

```tsx
// apps/web/components/translate/study-panel.tsx
"use client";

import { useEffect, useState } from "react";
import { LearnableSuggestionsCard } from "@/components/learnables/learnable-suggestions-card";
import { PracticeChunksCard } from "@/components/practice-chunks/practice-chunks-card";
import { Button } from "@/components/ui/button";
import { displayForCharacterSet } from "@/lib/characters";
import type {
  CharacterSet,
  DictionaryEntry,
  LearnableSuggestion,
  PracticeChunkSuggestion,
} from "@mindyourlanguage/shared";

export type StudyTabId = "chunks" | "learnables" | "dictionary";

const TAB_LABELS: Record<StudyTabId, string> = {
  chunks: "Chunks",
  learnables: "New bits",
  dictionary: "Dictionary",
};

export interface StudyPanelProps {
  availableTabs: StudyTabId[];
  tab: StudyTabId;
  onTabChange: (tab: StudyTabId) => void;
  counts: Record<StudyTabId, number>;
  characterSet: CharacterSet;
  chunksLoading: boolean;
  chunksSuggestEmpty: boolean;
  chunkItems: PracticeChunkSuggestion[];
  onSaveChunksSelected: (items: PracticeChunkSuggestion[]) => void;
  onSaveFullOnly: () => void;
  onRetryChunks: () => void;
  learnablesLoading: boolean;
  learnableItems: LearnableSuggestion[];
  onSaveLearnablesSelected: (items: LearnableSuggestion[]) => void;
  dictionaryEntries: DictionaryEntry[];
  activeEntryKey: string | null;
  activeEntrySource: "passage" | "panel" | null;
  onActivateEntry: (key: string | null) => void;
}

function DictionaryCards({
  entries,
  characterSet,
  activeEntryKey,
  onActivateEntry,
}: {
  entries: DictionaryEntry[];
  characterSet: CharacterSet;
  activeEntryKey: string | null;
  onActivateEntry: (key: string | null) => void;
}) {
  const [showTraditional, setShowTraditional] = useState(false);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No dictionary matches for this translation.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          aria-pressed={showTraditional}
          onClick={() => setShowTraditional((value) => !value)}
          className="rounded-full border border-border px-3 py-1 text-label-sm text-muted-foreground transition-colors duration-state-change ease-state-change hover:bg-muted aria-pressed:bg-secondary aria-pressed:text-foreground"
        >
          繁 Traditional
        </button>
      </div>
      <ul className="flex flex-col gap-2" aria-label="Dictionary matches">
        {entries.map((entry) => {
          const active = activeEntryKey === entry.simplified;
          return (
            <li key={entry.simplified} id={`dict-card-${entry.simplified}`}>
              <button
                type="button"
                data-testid="dictionary-card"
                data-active={active || undefined}
                onClick={() => onActivateEntry(active ? null : entry.simplified)}
                className={`w-full rounded-lg border bg-card p-3 text-left transition-colors duration-state-change ease-state-change hover:border-primary/50 ${
                  active
                    ? "border-primary ring-1 ring-primary"
                    : "border-border"
                }`}
              >
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="text-title-md text-foreground">
                    {displayForCharacterSet(entry.simplified, characterSet)}
                  </span>
                  <span
                    lang="zh-Latn"
                    className="font-mono text-mono-sm text-muted-foreground"
                  >
                    {entry.pinyin}
                  </span>
                </p>
                {showTraditional && entry.traditional !== entry.simplified ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    繁 {entry.traditional}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.definitions.join("; ")}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StudyPanel({
  availableTabs,
  tab,
  onTabChange,
  counts,
  characterSet,
  chunksLoading,
  chunksSuggestEmpty,
  chunkItems,
  onSaveChunksSelected,
  onSaveFullOnly,
  onRetryChunks,
  learnablesLoading,
  learnableItems,
  onSaveLearnablesSelected,
  dictionaryEntries,
  activeEntryKey,
  activeEntrySource,
  onActivateEntry,
}: StudyPanelProps) {
  // Passage-initiated activation scrolls the matching card into view.
  useEffect(() => {
    if (activeEntrySource !== "passage" || !activeEntryKey) return;
    if (tab !== "dictionary") return;
    document
      .getElementById(`dict-card-${CSS.escape(activeEntryKey)}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeEntryKey, activeEntrySource, tab]);

  if (availableTabs.length === 0) return null;

  return (
    <section
      aria-label="Study panel"
      data-testid="study-panel"
      className="flex flex-col gap-4 rounded-lg bg-surface-low p-gutter-md"
    >
      <div
        role="tablist"
        aria-label="Study sections"
        className="flex flex-wrap gap-1 rounded-full bg-muted p-1"
      >
        {availableTabs.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            data-testid={`study-tab-${id}`}
            onClick={() => onTabChange(id)}
            className={`rounded-full px-3 py-1 text-sm transition-colors duration-state-change ease-state-change ${
              tab === id
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {TAB_LABELS[id]} ({counts[id]})
          </button>
        ))}
      </div>

      <div role="tabpanel" className="flex flex-col gap-4">
        {tab === "chunks" ? (
          <>
            {chunksSuggestEmpty && !chunksLoading ? (
              <div
                role="status"
                data-testid="practice-chunks-empty"
                className="flex flex-col gap-3 rounded-lg bg-warning-container px-4 py-3 text-on-warning-container"
              >
                <p className="text-sm font-medium">
                  Practice chunks unavailable — this phrase resisted splitting.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-card"
                    onClick={onRetryChunks}
                  >
                    Retry chunks
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-card"
                    onClick={onSaveFullOnly}
                  >
                    Save full phrase
                  </Button>
                </div>
              </div>
            ) : null}
            <PracticeChunksCard
              items={chunkItems}
              loading={chunksLoading}
              characterSet={characterSet}
              onSaveFullOnly={onSaveFullOnly}
              onSaveSelected={onSaveChunksSelected}
            />
          </>
        ) : null}
        {tab === "learnables" ? (
          <LearnableSuggestionsCard
            items={learnableItems}
            loading={learnablesLoading}
            characterSet={characterSet}
            onSaveSelected={onSaveLearnablesSelected}
          />
        ) : null}
        {tab === "dictionary" ? (
          <DictionaryCards
            entries={dictionaryEntries}
            characterSet={characterSet}
            activeEntryKey={activeEntryKey}
            onActivateEntry={onActivateEntry}
          />
        ) : null}
      </div>
    </section>
  );
}
```

Note `PracticeChunksCard` returns `null` when `items` is empty and not loading, so a failed chunk load shows only the banner — matching the old dead-end behavior.

Delete the absorbed panel:

```bash
rm apps/web/components/grounding-panel.tsx apps/web/components/grounding-panel.test.ts
```

(`lib/dictionary-grounding.ts` and its test stay — curation helpers are used server-side.)

### Step 4: verify

```bash
cd apps/web && npm test -- study-panel
```

Expected: 8 tests pass. (`page.tsx` still imports `GroundingPanel` — fixed next.)

---

## Task 6: `page.tsx` — two-column workspace rewiring

**Files:**
- Modify: `apps/web/app/page.tsx`
- Delete: `apps/web/components/try-first-panel.tsx`, `apps/web/components/comparison-panel.tsx`
- Test: `apps/web/app/page.workspace.test.ts` (new, fs source-assertions)

### Step 1: RED — failing structure test

```ts
// apps/web/app/page.workspace.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("translate workspace layout", () => {
  it("uses a 12-column grid inside max-w-7xl", () => {
    expect(source).toContain("max-w-7xl");
    expect(source).toContain("lg:grid-cols-12");
    expect(source).toContain("lg:col-span-7");
    expect(source).toContain("lg:col-span-5");
  });

  it("makes the study panel column sticky on desktop", () => {
    expect(source).toContain("lg:sticky");
  });

  it("composes the new workspace components", () => {
    expect(source).toContain("<ComposerCard");
    expect(source).toContain("<ResultCard");
    expect(source).toContain("<ReadingPassage");
    expect(source).toContain("<StudyPanel");
  });

  it("drops the removed panels", () => {
    expect(source).not.toContain("TryFirstPanel");
    expect(source).not.toContain("ComparisonPanel");
    expect(source).not.toContain("NativeAlternativeCard");
    expect(source).not.toContain("GroundingPanel");
    expect(source).not.toContain("tryFirstEnabled");
  });

  it("gates the reading passage to EN-to-ZH results", () => {
    expect(source).toContain("isEnglishToChinese && result ? (");
  });
});
```

### Step 2: run to confirm failure

```bash
cd apps/web && npm test -- page.workspace
```

### Step 3: GREEN — rewire `apps/web/app/page.tsx`

Apply these edits to the current file:

**a) Imports — remove:**
```ts
import { ComparisonPanel } from "@/components/comparison-panel";
import { GroundingPanel } from "@/components/grounding-panel";
import { NativeAlternativeCard } from "@/components/native-alternative-card";
import { TryFirstPanel } from "@/components/try-first-panel";
import { Toggles } from "@/components/toggles";
```

**b) Imports — add:**
```ts
import { ComposerCard } from "@/components/translate/composer-card";
import { ReadingPassage } from "@/components/translate/reading-passage";
import {
  StudyPanel,
  type StudyTabId,
} from "@/components/translate/study-panel";
```

**c) State — remove `tryFirstEnabled`, `userAttempt`, and the `submittedAttempt` memo. Add:**
```ts
  const [studyTab, setStudyTab] = useState<StudyTabId>("dictionary");
  const [activeEntry, setActiveEntry] = useState<{
    key: string;
    source: "passage" | "panel";
  } | null>(null);
```

**d) Derived — add below `isSaved`:**
```ts
  const availableTabs = useMemo<StudyTabId[]>(() => {
    if (!result) return [];
    const tabs: StudyTabId[] = [];
    if (isEnglishToChinese && practiceChunks.visible) tabs.push("chunks");
    if (isEnglishToChinese && learnables.visible) tabs.push("learnables");
    if (result.dictionaryMatches.length > 0) tabs.push("dictionary");
    return tabs;
  }, [result, isEnglishToChinese, practiceChunks.visible, learnables.visible]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(studyTab)) {
      setStudyTab(availableTabs[0]);
    }
  }, [availableTabs, studyTab]);

  const studyCounts: Record<StudyTabId, number> = {
    chunks: practiceChunks.items.length,
    learnables: learnables.items.length,
    dictionary: result?.dictionaryMatches.length ?? 0,
  };
```

**e) Handlers — add:**
```ts
  function handleActivateFromPassage(key: string) {
    setActiveEntry({ key, source: "passage" });
    setStudyTab("dictionary");
  }

  function handleActivateFromPanel(key: string | null) {
    setActiveEntry(key ? { key, source: "panel" } : null);
  }

  function handleRetryChunks() {
    if (!result || !sourceText.trim()) return;
    void practiceChunks.load(sourceText, result.translation);
  }
```

**f) In `handleClear`, `restoreRecord`, `restorePhrasebook` and at the top of `handleTranslate` (next to the existing `learnables.clear(); practiceChunks.clear();`), add:**
```ts
    setActiveEntry(null);
```
(In `handleTranslate`/`handleClear` also `setStudyTab("dictionary")` is unnecessary — the availability effect corrects the tab once new results land.)

**g) Replace the entire `return (…)` JSX with:**

```tsx
  return (
    <main className="mx-auto grid w-full min-w-0 max-w-7xl flex-1 gap-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
        <ComposerCard
          characterSet={characterSet}
          onCharacterSetChange={setCharacterSet}
          voiceRegion={voiceRegion}
          onVoiceRegionChange={setVoiceRegion}
          sourceText={sourceText}
          onSourceTextChange={setSourceText}
          onSubmit={handleTranslate}
          onClear={handleClear}
          isLoading={isLoading}
          direction={direction}
          onDirectionChange={setDirection}
          showNativeAlternative={isEnglishToChinese}
          includeNativeAlternative={includeNativeAlternative}
          onIncludeNativeAlternativeChange={setIncludeNativeAlternative}
        />

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {result ? (
          <>
            <ResultCard
              result={result}
              characterSet={characterSet}
              layout={resultLayout}
              sourceText={sourceText}
              showPlayButtons={showPlayButtons}
              voiceRegion={voiceRegion}
              isSaved={isSaved}
              onToggleSave={handleToggleSave}
              phrasebookHint={
                isEnglishToChinese &&
                (learnables.visible || practiceChunks.visible)
                  ? "Save the full phrase, or pick chunks and new bits in the study panel."
                  : undefined
              }
            />
            {isEnglishToChinese && result ? (
              <ReadingPassage
                text={
                  characterSet === "traditional" && result.traditional
                    ? result.traditional
                    : result.translation
                }
                pinyin={result.pinyin}
                entries={result.dictionaryMatches}
                activeEntryKey={activeEntry?.key ?? null}
                onActivateEntry={handleActivateFromPassage}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <div className="min-w-0 lg:col-span-5">
        {result && availableTabs.length > 0 ? (
          <div className="lg:sticky lg:top-20">
            <StudyPanel
              availableTabs={availableTabs}
              tab={studyTab}
              onTabChange={setStudyTab}
              counts={studyCounts}
              characterSet={characterSet}
              chunksLoading={practiceChunks.loading}
              chunksSuggestEmpty={practiceChunks.suggestEmpty}
              chunkItems={practiceChunks.items}
              onSaveChunksSelected={(selected) => {
                const parent = buildParentFieldsFromResult();
                if (!parent) return;
                practiceChunks.saveSelected(selected, parent);
              }}
              onSaveFullOnly={handleToggleSave}
              onRetryChunks={handleRetryChunks}
              learnablesLoading={learnables.loading}
              learnableItems={learnables.items}
              onSaveLearnablesSelected={learnables.saveSelected}
              dictionaryEntries={result.dictionaryMatches}
              activeEntryKey={activeEntry?.key ?? null}
              activeEntrySource={activeEntry?.source ?? null}
              onActivateEntry={handleActivateFromPanel}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
```

**h) Delete the dropped components:**

```bash
rm apps/web/components/try-first-panel.tsx apps/web/components/comparison-panel.tsx
```

Note: the `submittedAttempt` memo and `tryFirstEnabled`/`userAttempt` state must be fully removed (steps c), or the unused vars will fail lint. `UserAttempt` has no other consumers.

### Step 4: verify

```bash
cd apps/web && npm test -- page.workspace && npm run lint && npm run build
```

Expected: structure test passes, lint clean, build compiles. (`npm run build` needs network for the Google Fonts fetch from Plan 1.)

---

## Task 7: e2e updates

**Files:**
- Modify: `apps/web/e2e/translate.spec.ts`
- Modify: `apps/web/e2e/practice.spec.ts`
- Create: `apps/web/e2e/workspace.spec.ts`

### Step 1: update `translate.spec.ts`

- In `'translates English and shows result + play controls'`: replace the two Play-region assertions with:
  ```ts
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Play at 0.75 speed' })).toBeEnabled()
  ```
  Keep the `'to know (a person)'` assertion, but make it deterministic first — the fixture translation may or may not trigger a chunks load (unmocked API), so the default study tab can be Chunks or Dictionary:
  ```ts
  const dictionaryTab = page.getByTestId('study-tab-dictionary')
  if (await dictionaryTab.isVisible()) await dictionaryTab.click()
  await expect(page.getByText('to know (a person)')).toBeVisible()
  ```
- In `'shows source pinyin for Chinese to English'`: replace the `'Play Mainland'` assertion with the same two lines above.
- Add a register-tab test:
  ```ts
  test('switches between translation and native alternative registers', async ({ page }) => {
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toHaveText('你好，很高兴认识你。')

    await page.getByTestId('native-register-tab').click()
    await expect(page.getByTestId('native-panel')).toContainText('你好，幸会。')
    await expect(page.getByTestId('native-panel')).toContainText('More concise greeting.')
  })
  ```

### Step 2: update `practice.spec.ts`

Delete the `'try first shows comparison after translate'` test entirely (feature dropped). The remaining three tests are untouched.

### Step 3: create `workspace.spec.ts`

```ts
import { expect, test } from '@playwright/test'
import { enterSourceText } from './helpers/enter-source-text'
import { mockTranslateApi } from './helpers/mock-translate'

test.describe('translate workspace (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
  })

  test('desktop shows the reading passage with a synced dictionary token', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.getByTestId('reading-passage')).toBeVisible()

    const token = page.getByTestId('passage-token').first()
    await expect(token).toHaveAttribute('data-entry-key', '认识')
    await token.click()
    await expect(token).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByTestId('dictionary-card').first(),
    ).toHaveAttribute('data-active', 'true')
  })

  test('mobile hides the reading passage but keeps the study panel', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId('reading-passage')).toBeHidden()
    await expect(page.getByTestId('study-panel')).toBeVisible()
    await expect(page.getByTestId('study-tab-dictionary')).toBeVisible()
  })

  test('pinyin toggle reveals the pinyin line', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByTestId('passage-pinyin-toggle').click()
    await expect(page.getByTestId('passage-pinyin')).toContainText('nǐ hǎo')
  })
})
```

The viewport must be set before the passage assertions but after navigation is fine — the passage is CSS-hidden, so Playwright's `toBeVisible`/`toBeHidden` responds to the live viewport.

### Step 4: full verification

```bash
cd apps/web && npm test && npm run lint && npm run build && npm run test:e2e
```

Expected: unit suite green (including `reading-passage` 10, `composer-card` 6, `result-card` 6, `study-panel` 8, `page.workspace` 5), lint clean, build compiles, e2e green.

---

## Done-when checklist

- [ ] `/` renders the two-column workspace on desktop; single column on mobile
- [ ] Register tabs swap Translation ↔ Native alternative inside the result card
- [ ] Footer: Play / 0.75× / Save / Copy — no Mainland/Taiwan/Stop/Segments buttons
- [ ] Desktop passage tokens highlight and scroll the matching dictionary card; card clicks highlight tokens back
- [ ] StudyPanel shows Chunks / New bits / Dictionary tabs with live counts; only applicable tabs render
- [ ] Chunk failure shows the amber banner with Retry + Save full phrase
- [ ] `try-first-panel.tsx`, `comparison-panel.tsx`, `native-alternative-card.tsx`, `grounding-panel.tsx` deleted; Try First state gone from `page.tsx`
- [ ] e2e suite updated and green
- [ ] Screenshot review against `translate_study_workspace` and `translate_study_mobile` mocks
