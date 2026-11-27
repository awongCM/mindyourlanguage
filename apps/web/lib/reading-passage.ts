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