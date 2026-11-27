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
      className={`rounded-sm px-0.5 underline decoration-dotted underline-offset-4 transition-colors duration-state-change ease-state-change focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-secondary/60 ${
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
      className="hidden lg:flex lg:flex-col lg:gap-3 rounded-lg border border-border bg-card p-gutter-md"
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
          <p
            key={sentenceIndex}
            lang="zh"
            className="text-reading-lg text-foreground"
          >
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
