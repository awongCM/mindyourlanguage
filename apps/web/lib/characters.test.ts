import { describe, it, expect } from 'vitest'
import { toTraditionalChars, toSimplifiedChars } from './characters'

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
