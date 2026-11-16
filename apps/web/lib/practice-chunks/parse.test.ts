import { describe, expect, it } from 'vitest'
import {
  MAX_PRACTICE_CHUNKS,
  parsePracticeChunksResponse,
  phrasebookFieldsFromChunk,
} from './parse'

describe('parsePracticeChunksResponse', () => {
  it('keeps valid ordered chunks and drops empties/duplicates', () => {
    const content = JSON.stringify({
      items: [
        { english: 'One idea', chinese: '一个意思' },
        { english: '', chinese: '空' },
        { english: 'One idea', chinese: '一个意思' },
        { english: 'Next', chinese: '下一个' },
      ],
    })
    expect(parsePracticeChunksResponse(content)).toEqual([
      { english: 'One idea', chinese: '一个意思' },
      { english: 'Next', chinese: '下一个' },
    ])
  })

  it('caps at MAX_PRACTICE_CHUNKS', () => {
    const items = Array.from({ length: MAX_PRACTICE_CHUNKS + 5 }, (_, i) => ({
      english: `E${i}`,
      chinese: `中${i}`,
    }))
    expect(parsePracticeChunksResponse(JSON.stringify({ items }))).toHaveLength(
      MAX_PRACTICE_CHUNKS,
    )
  })

  it('returns [] on bad JSON', () => {
    expect(parsePracticeChunksResponse('nope')).toEqual([])
  })
})

describe('phrasebookFieldsFromChunk', () => {
  it('maps chunk fields onto a child phrasebook create payload', () => {
    expect(
      phrasebookFieldsFromChunk(
        { english: 'One idea', chinese: '一个意思', pinyin: 'yī gè yì si' },
        'simplified',
        'parent-1',
      ),
    ).toMatchObject({
      sourceText: 'One idea',
      translation: '一个意思',
      pinyin: 'yī gè yì si',
      parentId: 'parent-1',
      sourceLang: 'en',
      targetLang: 'zh',
      characterSet: 'simplified',
      translationId: null,
      tags: ['chunk'],
    })
  })
})