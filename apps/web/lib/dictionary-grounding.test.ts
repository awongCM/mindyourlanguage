import { describe, expect, it } from 'vitest'
import type { DictionaryEntry } from '@mindyourlanguage/shared'
import {
  curateDictionaryMatches,
  getVisibleGroundingEntries,
  isCommonGroundingTerm,
  scoreGroundingMatch,
} from './dictionary-grounding'

function entry(
  simplified: string,
  definitions: string[],
): DictionaryEntry {
  return {
    simplified,
    traditional: simplified,
    pinyin: `pin:${simplified}`,
    definitions,
  }
}

describe('isCommonGroundingTerm', () => {
  it('flags ultra-common words and single characters', () => {
    expect(isCommonGroundingTerm('的')).toBe(true)
    expect(isCommonGroundingTerm('一个')).toBe(true)
    expect(isCommonGroundingTerm('指出')).toBe(false)
    expect(isCommonGroundingTerm('吉隆坡')).toBe(false)
  })
})

describe('scoreGroundingMatch', () => {
  it('prefers longer compounds and place names', () => {
    const place = scoreGroundingMatch(
      '吉隆坡',
      entry('吉隆坡', ['capital of Malaysia']),
    )
    const commonChar = scoreGroundingMatch('日', entry('日', ['day', 'sun']))
    expect(place).toBeGreaterThan(commonChar)
  })
})

describe('curateDictionaryMatches', () => {
  it('drops common terms and ranks study-worthy vocabulary first', () => {
    const curated = curateDictionaryMatches([
      {
        segmentText: '指出',
        position: 0,
        entry: entry('指出', ['to point out']),
      },
      {
        segmentText: '吉隆坡',
        position: 1,
        entry: entry('吉隆坡', ['capital of Malaysia']),
      },
      {
        segmentText: '卫生部',
        position: 2,
        entry: entry('卫生部', ['health department']),
      },
    ])

    expect(curated.map((item) => item.simplified)).toEqual([
      '吉隆坡',
      '卫生部',
      '指出',
    ])
  })
})

describe('getVisibleGroundingEntries', () => {
  it('shows preview count until expanded', () => {
    const entries = Array.from({ length: 20 }, (_, index) =>
      entry(`词${index}`, [`definition ${index}`]),
    )

    expect(getVisibleGroundingEntries(entries, false)).toHaveLength(15)
    expect(getVisibleGroundingEntries(entries, true)).toHaveLength(20)
  })
})
