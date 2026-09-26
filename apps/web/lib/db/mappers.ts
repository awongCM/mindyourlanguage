import type {
  CharacterSet,
  DictionaryEntry,
  Lang,
  PhrasebookEntry,
  PracticeStats,
  Register,
  ReviewEvent,
  ReviewEventMode,
  ReviewGrade,
  TranslationRecord,
  TranslationSegment,
} from '@mindyourlanguage/shared'

export type TranslationRow = {
  id: string
  user_id: string | null
  source_text: string
  source_lang: Lang
  target_lang: Lang
  translation: string
  traditional: string | null
  pinyin: string | null
  character_set: CharacterSet
  native_alternative: string | null
  register: Register | null
  native_note: string | null
  dictionary_matches: DictionaryEntry[] | string
  segments: TranslationSegment[] | string
  created_at: Date | string
}

export type PhrasebookRow = {
  id: string
  user_id: string | null
  translation_id: string | null
  source_text: string | null
  source_lang: Lang | null
  target_lang: Lang | null
  translation: string | null
  traditional: string | null
  pinyin: string | null
  character_set: CharacterSet | null
  register: Register | null
  native_alternative: string | null
  native_note: string | null
  dictionary_matches: DictionaryEntry[] | string | null
  segments: TranslationSegment[] | string | null
  practice_stats: PracticeStats | string | null
  tags: string[] | null
  notes: string | null
  created_at: Date | string
}

export type ReviewEventRow = {
  id: string
  phrase_id: string
  grade: ReviewGrade
  reviewed_at: Date | string
  mode: ReviewEventMode
}

function parseJsonField<T>(value: T | string | null | undefined, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

function toIsoString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

export function translationRowToRecord(row: TranslationRow): TranslationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    sourceText: row.source_text,
    sourceLang: row.source_lang,
    targetLang: row.target_lang,
    translation: row.translation,
    traditional: row.traditional ?? undefined,
    pinyin: row.pinyin ?? undefined,
    characterSet: row.character_set,
    register: row.register ?? undefined,
    nativeAlternative: row.native_alternative ?? undefined,
    nativeNote: row.native_note ?? undefined,
    dictionaryMatches: parseJsonField<DictionaryEntry[]>(
      row.dictionary_matches,
      [],
    ),
    segments: parseJsonField<TranslationSegment[]>(row.segments, []),
    createdAt: toIsoString(row.created_at),
  }
}

export function recordToTranslationRow(
  record: TranslationRecord,
): Omit<TranslationRow, 'user_id' | 'created_at'> & {
  created_at?: string
} {
  return {
    id: record.id,
    source_text: record.sourceText,
    source_lang: record.sourceLang,
    target_lang: record.targetLang,
    translation: record.translation,
    traditional: record.traditional ?? null,
    pinyin: record.pinyin ?? null,
    character_set: record.characterSet,
    native_alternative: record.nativeAlternative ?? null,
    register: record.register ?? null,
    native_note: record.nativeNote ?? null,
    dictionary_matches: record.dictionaryMatches,
    segments: record.segments,
    created_at: record.createdAt,
  }
}

export function phrasebookRowToEntry(row: PhrasebookRow): PhrasebookEntry {
  return {
    id: row.id,
    translationId: row.translation_id,
    sourceText: row.source_text ?? '',
    sourceLang: row.source_lang ?? 'en',
    targetLang: row.target_lang ?? 'zh',
    translation: row.translation ?? '',
    traditional: row.traditional ?? undefined,
    pinyin: row.pinyin ?? undefined,
    characterSet: row.character_set ?? 'simplified',
    register: row.register ?? undefined,
    nativeAlternative: row.native_alternative ?? undefined,
    nativeNote: row.native_note ?? undefined,
    dictionaryMatches: parseJsonField<DictionaryEntry[]>(
      row.dictionary_matches,
      [],
    ),
    segments: parseJsonField<TranslationSegment[]>(row.segments, []),
    tags: row.tags ?? [],
    notes: row.notes ?? '',
    createdAt: toIsoString(row.created_at),
    practiceStats:
      row.practice_stats == null
        ? undefined
        : (parseJsonField<PracticeStats | null>(row.practice_stats, null) ??
          undefined),
  }
}

export function entryToPhrasebookRow(
  entry: PhrasebookEntry,
): Omit<PhrasebookRow, 'user_id' | 'created_at'> & { created_at?: string } {
  return {
    id: entry.id,
    translation_id: entry.translationId,
    source_text: entry.sourceText,
    source_lang: entry.sourceLang,
    target_lang: entry.targetLang,
    translation: entry.translation,
    traditional: entry.traditional ?? null,
    pinyin: entry.pinyin ?? null,
    character_set: entry.characterSet,
    register: entry.register ?? null,
    native_alternative: entry.nativeAlternative ?? null,
    native_note: entry.nativeNote ?? null,
    dictionary_matches: entry.dictionaryMatches,
    segments: entry.segments,
    practice_stats: entry.practiceStats ?? null,
    tags: entry.tags,
    notes: entry.notes,
    created_at: entry.createdAt,
  }
}

export function reviewEventRowToEvent(row: ReviewEventRow): ReviewEvent {
  return {
    id: row.id,
    phraseId: row.phrase_id,
    grade: row.grade,
    reviewedAt: toIsoString(row.reviewed_at),
    mode: row.mode,
  }
}

export function eventToReviewEventRow(
  event: ReviewEvent,
): Omit<ReviewEventRow, 'mode'> & { mode?: ReviewEventMode } {
  return {
    id: event.id,
    phrase_id: event.phraseId,
    grade: event.grade,
    reviewed_at: event.reviewedAt,
    mode: event.mode,
  }
}
