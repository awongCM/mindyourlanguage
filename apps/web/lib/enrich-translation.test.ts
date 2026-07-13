import { describe, it, expect } from 'vitest'
import { enrichChineseTranslation } from './enrich-translation'

describe('enrichChineseTranslation', () => {
  it('returns pinyin, traditional, and segments for Chinese text', () => {
    const result = enrichChineseTranslation('你好')

    expect(result.pinyin).toMatch(/nǐ hǎo/)
    expect(result.traditional).toBe('你好')
    expect(result.segments.length).toBeGreaterThan(0)
    expect(result.segments[0]).toHaveProperty('text')
    expect(result.segments[0]).toHaveProperty('pinyin')
  })

  it('converts simplified characters to traditional in enrichment', () => {
    const result = enrichChineseTranslation('认识')

    expect(result.traditional).toBe('認識')
    expect(result.pinyin).toBeTruthy()
    expect(result.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '认' }),
        expect.objectContaining({ text: '识' }),
      ]),
    )
  })
})
