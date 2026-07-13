import { describe, it, expect } from 'vitest'
import type { TranslationRecord, DictionaryEntry } from './types'

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
      dictionaryMatches: [],
      segments: [],
      createdAt: new Date().toISOString(),
    }
    expect(record.sourceLang).toBe('en')
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
