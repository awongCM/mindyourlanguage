import { describe, it, expect } from 'vitest'
import { parseCedictLine } from './parse-line'

describe('parseCedictLine', () => {
  it('parses a standard CEDICT entry', () => {
    const entry = parseCedictLine(
      '認識 认识 [ren4 shi5] /to know/to recognize/',
    )
    expect(entry).toEqual({
      traditional: '認識',
      simplified: '认识',
      pinyin: 'ren4 shi5',
      definitions: ['to know', 'to recognize'],
    })
  })

  it('returns null for comments and empty lines', () => {
    expect(parseCedictLine('# comment')).toBeNull()
    expect(parseCedictLine('')).toBeNull()
  })
})
