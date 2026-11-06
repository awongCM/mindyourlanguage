import { describe, it, expect } from 'vitest'
import {
  displayForCharacterSet,
  normalizeChineseKey,
  toSimplifiedChars,
  toTraditionalChars,
} from './characters'

describe('toTraditionalChars', () => {
  it('converts simplified Chinese to traditional', () => {
    expect(toTraditionalChars('认识')).toBe('認識')
  })
})

describe('toSimplifiedChars', () => {
  it('converts traditional Chinese to simplified', () => {
    expect(toSimplifiedChars('認識')).toBe('认识')
  })
})

describe('displayForCharacterSet', () => {
  it('returns traditional only when requested', () => {
    expect(displayForCharacterSet('认识', 'simplified')).toBe('认识')
    expect(displayForCharacterSet('认识', 'traditional')).toBe('認識')
  })
})

describe('normalizeChineseKey', () => {
  it('strips whitespace', () => {
    expect(normalizeChineseKey(' 认 识 ')).toBe('认识')
  })
})
