import { describe, expect, it } from "vitest";
import {
  toTranslationRecord,
  translationRecordToResponse,
} from "./to-translation-record";

describe("toTranslationRecord", () => {
  it("maps request context and response into a full record", () => {
    const record = toTranslationRecord({
      response: {
        id: "abc",
        translation: "你好",
        traditional: "你好",
        pinyin: "nǐ hǎo",
        detectedLang: "en",
        segments: [{ text: "你好", pinyin: "nǐ hǎo" }],
        dictionaryMatches: [],
        nativeAlternative: "嗨",
        register: "casual",
      },
      sourceText: "Hello",
      sourceLang: "en",
      targetLang: "zh",
      characterSet: "simplified",
    });

    expect(record.id).toBe("abc");
    expect(record.userId).toBeNull();
    expect(record.sourceText).toBe("Hello");
    expect(record.sourceLang).toBe("en");
    expect(record.targetLang).toBe("zh");
    expect(record.characterSet).toBe("simplified");
    expect(record.nativeAlternative).toBe("嗨");
    expect(record.createdAt).toBeTruthy();
  });
});

describe("translationRecordToResponse", () => {
  it("rebuilds a translate response for UI restore", () => {
    const record = toTranslationRecord({
      response: {
        id: "abc",
        translation: "你好",
        detectedLang: "en",
        segments: [],
        dictionaryMatches: [],
      },
      sourceText: "Hello",
      sourceLang: "en",
      targetLang: "zh",
      characterSet: "traditional",
    });

    const response = translationRecordToResponse(record);
    expect(response.id).toBe("abc");
    expect(response.translation).toBe("你好");
    expect(response.detectedLang).toBe("en");
  });
});
