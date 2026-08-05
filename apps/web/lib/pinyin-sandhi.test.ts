import { describe, expect, it } from 'vitest'
import { toSpokenPinyin } from './pinyin-sandhi'

describe('toSpokenPinyin', () => {
  it('applies third-tone sandhi on consecutive third tones', () => {
    expect(toSpokenPinyin('你好')).toBe('ní hǎo')
    expect(toSpokenPinyin('很友好')).toBe('hén yóu hǎo')
  })

  it('applies 不 sandhi before fourth tone', () => {
    expect(toSpokenPinyin('不是')).toBe('bú shì')
  })

  it('applies 一 sandhi before fourth and non-fourth tones', () => {
    expect(toSpokenPinyin('一个人')).toBe('yí gè rén')
    expect(toSpokenPinyin('一起')).toBe('yì qǐ')
  })

  it('returns empty for blank or non-Chinese input', () => {
    expect(toSpokenPinyin('')).toBe('')
    expect(toSpokenPinyin('   ')).toBe('')
    expect(toSpokenPinyin('hello')).toBe('')
  })
})
