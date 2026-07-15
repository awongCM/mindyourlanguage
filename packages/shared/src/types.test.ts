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
    }

    expect(response.nativeAlternative).toBe('嗨')
    expect(response.register).toBe('casual')
    expect(response.nativeNote).toContain('casual')
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
