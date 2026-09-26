import { describe, expect, it } from 'vitest'
import type {
  PhrasebookEntry,
  TranslationRecord,
} from '@mindyourlanguage/shared'
import {
  entryToPhrasebookRow,
  phrasebookRowToEntry,
  recordToTranslationRow,
  reviewEventRowToEvent,
  translationRowToRecord,
} from './mappers'

const dictionaryMatches = [
  {
    simplified: '你好',
    traditional: '你好',
    pinyin: 'nǐ hǎo',
    definitions: ['hello'],
  },
]

describe('translation mappers', () => {
  const record: TranslationRecord = {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    sourceText: 'Hello',
    sourceLang: 'en',
    targetLang: 'zh',
    translation: '你好',
    traditional: '你好',
    pinyin: 'nǐ hǎo',
    characterSet: 'simplified',
    register: 'casual',
    nativeAlternative: '嗨',
    nativeNote: 'Casual greeting',
    dictionaryMatches,
    segments: [{ text: '你好', pinyin: 'nǐ hǎo' }],
    createdAt: '2026-01-15T10:00:00.000Z',
  }

  it('round-trips TranslationRecord through row shape', () => {
    const row = recordToTranslationRow(record)
    expect(row.dictionary_matches).toEqual(dictionaryMatches)
    expect(row.segments).toEqual(record.segments)

    const parsed = translationRowToRecord({
      id: row.id,
      user_id: record.userId,
      source_text: row.source_text,
      source_lang: row.source_lang,
      target_lang: row.target_lang,
      translation: row.translation,
      traditional: row.traditional,
      pinyin: row.pinyin,
      character_set: row.character_set,
      native_alternative: row.native_alternative,
      register: row.register,
      native_note: row.native_note,
      dictionary_matches: row.dictionary_matches,
      segments: row.segments,
      created_at: new Date(record.createdAt),
    })

    expect(parsed).toEqual(record)
  })

  it('parses JSONB fields when returned as strings from Postgres', () => {
    const parsed = translationRowToRecord({
      id: record.id,
      user_id: null,
      source_text: 'Hi',
      source_lang: 'en',
      target_lang: 'zh',
      translation: '嗨',
      traditional: null,
      pinyin: null,
      character_set: 'simplified',
      native_alternative: null,
      register: null,
      native_note: null,
      dictionary_matches: JSON.stringify([]),
      segments: JSON.stringify([{ text: '嗨', pinyin: 'hāi' }]),
      created_at: '2026-02-01T00:00:00.000Z',
    })

    expect(parsed.dictionaryMatches).toEqual([])
    expect(parsed.segments).toEqual([{ text: '嗨', pinyin: 'hāi' }])
    expect(parsed.createdAt).toBe('2026-02-01T00:00:00.000Z')
  })
})

describe('phrasebook mappers', () => {
  const entry: PhrasebookEntry = {
    id: '33333333-3333-4333-8333-333333333333',
    translationId: '11111111-1111-4111-8111-111111111111',
    sourceText: 'Hello',
    sourceLang: 'en',
    targetLang: 'zh',
    translation: '你好',
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
    tags: ['greeting'],
    notes: 'note',
    createdAt: '2026-01-20T12:00:00.000Z',
    practiceStats: {
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 1,
      nextReviewAt: '2026-01-21T12:00:00.000Z',
    },
  }

  it('round-trips PhrasebookEntry through row shape', () => {
    const row = entryToPhrasebookRow(entry)
    const parsed = phrasebookRowToEntry({
      id: row.id,
      user_id: '22222222-2222-4222-8222-222222222222',
      translation_id: row.translation_id,
      source_text: row.source_text,
      source_lang: row.source_lang,
      target_lang: row.target_lang,
      translation: row.translation,
      traditional: row.traditional,
      pinyin: row.pinyin,
      character_set: row.character_set,
      register: row.register,
      native_alternative: row.native_alternative,
      native_note: row.native_note,
      dictionary_matches: row.dictionary_matches,
      segments: row.segments,
      practice_stats: row.practice_stats,
      tags: row.tags,
      notes: row.notes,
      created_at: new Date(entry.createdAt),
    })

    expect(parsed).toEqual(entry)
  })
})

describe('reviewEventRowToEvent', () => {
  it('maps snake_case row to ReviewEvent', () => {
    expect(
      reviewEventRowToEvent({
        id: '44444444-4444-4444-8444-444444444444',
        phrase_id: '33333333-3333-4333-8333-333333333333',
        grade: 'good',
        reviewed_at: new Date('2026-03-01T08:00:00.000Z'),
        mode: 'self_grade',
      }),
    ).toEqual({
      id: '44444444-4444-4444-8444-444444444444',
      phraseId: '33333333-3333-4333-8333-333333333333',
      grade: 'good',
      reviewedAt: '2026-03-01T08:00:00.000Z',
      mode: 'self_grade',
    })
  })
})
