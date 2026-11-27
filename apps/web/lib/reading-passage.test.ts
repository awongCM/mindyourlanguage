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
