import { describe, expect, it } from 'vitest'

import {
  differsFromPrimary,
  parseNativeAlternativeResponse,
  registerLabel,
  shouldRequestNativeAlternative,
} from './native-alternative-shared'

describe('differsFromPrimary', () => {
  it('treats whitespace-normalized matches as unchanged', () => {
    expect(differsFromPrimary('你好， 世界', ' 你好，   世界 ')).toBe(false)
  })

  it('detects a real wording difference', () => {
    expect(differsFromPrimary('你好，世界', '大家好，世界')).toBe(true)
  })
})

describe('parseNativeAlternativeResponse', () => {
  it('parses a valid JSON response', () => {
    const result = parseNativeAlternativeResponse(
      JSON.stringify({
        nativeAlternative: '很高兴认识你。',
        register: 'casual',
        note: 'Sounds more natural in conversation.',
      }),
    )

    expect(result).toEqual({
      nativeAlternative: '很高兴认识你。',
      register: 'casual',
      note: 'Sounds more natural in conversation.',
    })
  })

  it('returns null for an invalid register', () => {
    const result = parseNativeAlternativeResponse(
      JSON.stringify({
        nativeAlternative: '很高兴认识你。',
        register: 'friendly',
      }),
    )

    expect(result).toBeNull()
  })
})

describe('registerLabel', () => {
  it.each([
    ['formal', '书面'],
    ['casual', '口语'],
    ['neutral', '中性'],
  ] as const)('maps %s to %s', (register, label) => {
    expect(registerLabel(register)).toBe(label)
  })
})

describe('shouldRequestNativeAlternative', () => {
  const baseRequest = {
    sourceLang: 'en',
    targetLang: 'zh',
    includeNativeAlternative: true,
  } as const

  it('returns true for opted-in English to Chinese translations with at least two Chinese characters', () => {
    expect(shouldRequestNativeAlternative(baseRequest, '你好')).toBe(true)
  })

  it.each([
    ['not opted in', { ...baseRequest, includeNativeAlternative: false }, '你好'],
    ['wrong source language', { ...baseRequest, sourceLang: 'zh' }, '你好'],
    ['wrong target language', { ...baseRequest, targetLang: 'en' }, '你好'],
    ['fewer than two Chinese characters', baseRequest, '你!'],
  ] as const)('returns false when %s', (_name, request, translation) => {
    expect(shouldRequestNativeAlternative(request, translation)).toBe(false)
  })
})
