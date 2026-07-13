import { describe, it, expect } from 'vitest'
import { toPinyin, segmentChinese } from './pinyin'

describe('toPinyin', () => {
  it('returns tone-marked pinyin for Chinese text', () => {
    expect(toPinyin('你好')).toMatch(/nǐ hǎo/)
  })
})

describe('segmentChinese', () => {
  it('segments Chinese text into words', () => {
    const segments = segmentChinese('你好世界')
    expect(segments.length).toBeGreaterThan(0)
    expect(segments[0]).toHaveProperty('text')
    expect(segments[0]).toHaveProperty('pinyin')
  })
})
