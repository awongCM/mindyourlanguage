import type {
  CharacterSet,
  Lang,
  TranslateResponse,
  TranslationRecord,
} from "@mindyourlanguage/shared";

export function toTranslationRecord(input: {
  response: TranslateResponse;
  sourceText: string;
  sourceLang: Lang;
  targetLang: Lang;
  characterSet: CharacterSet;
}): TranslationRecord {
  const { response, sourceText, sourceLang, targetLang, characterSet } = input;

  return {
    id: response.id,
    userId: null,
    sourceText,
    sourceLang,
    targetLang,
    translation: response.translation,
    traditional: response.traditional,
    pinyin: response.pinyin,
    characterSet,
    register: response.register,
    nativeAlternative: response.nativeAlternative,
    nativeNote: response.nativeNote,
    dictionaryMatches: response.dictionaryMatches,
    segments: response.segments,
    createdAt: new Date().toISOString(),
  };
}

export function translationRecordToResponse(
  record: TranslationRecord,
): TranslateResponse {
  return {
    id: record.id,
    translation: record.translation,
    traditional: record.traditional,
    pinyin: record.pinyin,
    detectedLang: record.sourceLang,
    segments: record.segments,
    dictionaryMatches: record.dictionaryMatches,
    nativeAlternative: record.nativeAlternative,
    register: record.register,
    nativeNote: record.nativeNote,
  };
}
