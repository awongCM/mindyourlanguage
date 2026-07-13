import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@mindyourlanguage/dictionary', () => ({
  segment: vi.fn().mockReturnValue([{ text: '认识' }, { text: '你' }]),
  lookupTerm: vi.fn().mockImplementation((term: string) => {
    if (term === '认识') {
      return [
        {
          simplified: '认识',
          traditional: '認識',
          pinyin: 'ren4 shi5',
          definitions: ['to know'],
        },
      ]
    }
    return []
  }),
}))

vi.mock('./characters', () => ({
  toTraditionalChars: (t: string) => t,
}))

vi.mock('./pinyin', () => ({
  toPinyin: (t: string) => `py:${t}`,
}))

import { enrichChineseTranslation } from './enrich-translation'
import { lookupTerm, segment } from '@mindyourlanguage/dictionary'

describe('enrichChineseTranslation', () => {
  beforeEach(() => {
    vi.mocked(segment).mockClear()
    vi.mocked(segment).mockReturnValue([{ text: '认识' }, { text: '你' }])
    vi.mocked(lookupTerm).mockClear()
    vi.mocked(lookupTerm).mockImplementation((term: string) => {
      if (term === '认识') {
        return [
          {
            simplified: '认识',
            traditional: '認識',
            pinyin: 'ren4 shi5',
            definitions: ['to know'],
          },
        ]
      }
      return []
    })
  })

  it('returns pinyin, traditional, word segments, and dictionary matches', () => {
    const result = enrichChineseTranslation('认识你')

    expect(segment).toHaveBeenCalledWith('认识你')
    expect(result.pinyin).toBe('py:认识你')
    expect(result.traditional).toBe('认识你')
    expect(result.segments[0]).toEqual({ text: '认识', pinyin: 'py:认识' })
    expect(result.segments[1]).toEqual({ text: '你', pinyin: 'py:你' })
    expect(lookupTerm).toHaveBeenCalledWith('认识', 1)
    expect(lookupTerm).toHaveBeenCalledWith('你', 1)
    expect(result.dictionaryMatches).toHaveLength(1)
    expect(result.dictionaryMatches[0].simplified).toBe('认识')
  })

  it('dedupes dictionary lookups and caps matches at 15', () => {
    const words = [
      { text: '词0' },
      { text: '词0' },
      ...Array.from({ length: 16 }, (_, i) => ({ text: `词${i + 1}` })),
    ]
    vi.mocked(segment).mockReturnValue(words)
    vi.mocked(lookupTerm).mockImplementation((term: string) => [
      {
        simplified: term,
        traditional: term,
        pinyin: `pin:${term}`,
        definitions: [`definition:${term}`],
      },
    ])

    const result = enrichChineseTranslation('很多词')

    expect(result.dictionaryMatches).toHaveLength(15)
    expect(lookupTerm).toHaveBeenCalledTimes(15)
    expect(lookupTerm).toHaveBeenCalledWith('词0', 1)
    expect(
      vi.mocked(lookupTerm).mock.calls.filter(([term]) => term === '词0'),
    ).toHaveLength(1)
  })

  it('dedupes dictionary matches by simplified form after lookup', () => {
    vi.mocked(segment).mockReturnValue([{ text: '认识' }, { text: '認識' }])
    vi.mocked(lookupTerm).mockReturnValue([
      {
        simplified: '认识',
        traditional: '認識',
        pinyin: 'ren4 shi5',
        definitions: ['to know'],
      },
    ])

    const result = enrichChineseTranslation('认识認識')

    expect(lookupTerm).toHaveBeenCalledWith('认识', 1)
    expect(lookupTerm).toHaveBeenCalledWith('認識', 1)
    expect(result.dictionaryMatches).toEqual([
      {
        simplified: '认识',
        traditional: '認識',
        pinyin: 'ren4 shi5',
        definitions: ['to know'],
      },
    ])
  })

  it('falls back to character segments when dictionary segmentation fails', () => {
    vi.mocked(segment).mockImplementationOnce(() => {
      throw new Error('segment unavailable')
    })

    const result = enrichChineseTranslation('认识!')

    expect(result.segments).toEqual([
      { text: '认', pinyin: 'py:认' },
      { text: '识', pinyin: 'py:识' },
    ])
    expect(result.dictionaryMatches).toEqual([])
  })

  it('skips dictionary matches when lookup fails', () => {
    vi.mocked(lookupTerm).mockImplementationOnce(() => {
      throw new Error('lookup unavailable')
    })

    const result = enrichChineseTranslation('认识你')

    expect(result.segments).toHaveLength(2)
    expect(result.dictionaryMatches).toEqual([])
  })
})
