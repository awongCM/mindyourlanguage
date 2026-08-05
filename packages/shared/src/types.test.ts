import { describe, it, expect } from 'vitest'
import type { TranslationRecord, DictionaryEntry, TranslateRequest, TranslateResponse } from './types'

describe('TranslationRecord type', () => {
  it('accepts a valid translation record shape', () => {
    const record: TranslationRecord = {
      id: 'test-id',
      userId: null,
      sourceText: 'Hello',
      sourceLang: 'en',
      targetLang: 'zh',
      translation: '你好',
      characterSet: 'simplified',
      register: 'casual',
      nativeAlternative: '嗨',
      dictionaryMatches: [],
      segments: [],
      createdAt: new Date().toISOString(),
    }
    expect(record.sourceLang).toBe('en')
    expect(record.nativeAlternative).toBe('嗨')
  })
})

describe('TranslateRequest type', () => {
  it('accepts native alternative options', () => {
    const request: TranslateRequest = {
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'zh',
      characterSet: 'simplified',
      includeNativeAlternative: true,
      voiceRegion: 'zh-TW',
    }

    expect(request.includeNativeAlternative).toBe(true)
    expect(request.voiceRegion).toBe('zh-TW')
  })
})

describe('TranslateResponse type', () => {
  it('accepts optional native fields on a valid response shape', () => {
    const response: TranslateResponse = {
      id: 'test-id',
      translation: '你好',
      detectedLang: 'en',
      segments: [],
      dictionaryMatches: [],
      nativeAlternative: '嗨',
      register: 'casual',
      nativeNote: 'More natural in casual conversation.',
      spokenPinyin: 'ní hǎo',
    }

    expect(response.nativeAlternative).toBe('嗨')
    expect(response.register).toBe('casual')
    expect(response.nativeNote).toContain('casual')
    expect(response.spokenPinyin).toBe('ní hǎo')
  })
})

describe('PracticeStats and CheckAttempt types', () => {
  it('accepts practice stats on phrasebook entries', () => {
    const entry: import('./types').PhrasebookEntry = {
      id: 'pb-1',
      translationId: 'tr-1',
      sourceText: 'Hello',
      sourceLang: 'en',
      targetLang: 'zh',
      translation: '你好',
      characterSet: 'simplified',
      dictionaryMatches: [],
      segments: [],
      tags: [],
      notes: '',
      createdAt: new Date().toISOString(),
      practiceStats: {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: new Date().toISOString(),
      },
    }

    expect(entry.practiceStats?.easeFactor).toBe(2.5)
  })

  it('accepts check attempt request and response shapes', () => {
    const request: import('./types').CheckAttemptRequest = {
      sourceText: 'How are you?',
      userAttempt: '你好吗',
      primaryTranslation: '你好吗？',
      nativeAlternative: '你怎么样？',
    }
    const response: import('./types').CheckAttemptResponse = {
      verdict: 'close',
      feedback: 'Natural and clear.',
      corrections: [],
      betterPhrasing: '你怎么样？',
    }

    expect(request.userAttempt).toBe('你好吗')
    expect(response.verdict).toBe('close')
  })
})

describe('DictionaryEntry type', () => {
  it('accepts a valid dictionary entry shape', () => {
    const entry: DictionaryEntry = {
      simplified: '你好',
      traditional: '你好',
      pinyin: 'nǐ hǎo',
      definitions: ['hello', 'hi'],
    }
    expect(entry.simplified).toBe('你好')
    expect(entry.definitions).toHaveLength(2)
  })
})

describe('PhrasebookEntry type', () => {
  it('accepts a valid phrasebook entry shape', () => {
    const entry: import('./types').PhrasebookEntry = {
      id: 'pb-1',
      translationId: 'tr-1',
      sourceText: 'Hello',
      sourceLang: 'en',
      targetLang: 'zh',
      translation: '你好',
      characterSet: 'simplified',
      dictionaryMatches: [],
      segments: [],
      tags: ['greeting'],
      notes: 'Casual hello',
      createdAt: new Date().toISOString(),
    }

    expect(entry.tags).toContain('greeting')
    expect(entry.notes).toBe('Casual hello')
  })
})
