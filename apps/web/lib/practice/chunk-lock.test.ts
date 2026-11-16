import { describe, expect, it } from 'vitest'
import type { PhrasebookEntry } from '@mindyourlanguage/shared'
import {
  childrenOf,
  eligibleForChunkSuggest,
  isLockedParent,
  isParentUnlocked,
  MIN_CHUNKABLE_ZH_CHARS,
  parentChunkStatus,
  zhCharLength,
} from './chunk-lock'

function entry(id: string, patch: Partial<PhrasebookEntry> = {}): PhrasebookEntry {
  return {
    id,
    translationId: null,
    sourceText: 'Hello',
    sourceLang: 'en',
    targetLang: 'zh',
    translation: '你好',
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
    tags: [],
    notes: '',
    createdAt: '2026-11-16T00:00:00.000Z',
    ...patch,
  }
}

describe('zhCharLength', () => {
  it('counts Han characters', () => {
    expect(zhCharLength('一个意思。')).toBe(4)
    expect(zhCharLength('hi一个')).toBe(2)
  })
})

describe('parent unlock', () => {
  const parent = entry('p', {
    translation: '这是一段比较长的中文内容用来练习。',
  })

  it('locks parent while any child lacks graduatedAt', () => {
    const items = [
      parent,
      entry('c1', {
        parentId: 'p',
        practiceStats: {
          easeFactor: 2.5,
          intervalDays: 1,
          repetitions: 1,
          nextReviewAt: '2026-11-16T00:00:00.000Z',
          fluency: {
            graduatedAt: '2026-11-10T00:00:00.000Z',
            fastDays: ['2026-11-01', '2026-11-05', '2026-11-10'],
          },
        },
      }),
      entry('c2', { parentId: 'p' }),
    ]
    expect(isParentUnlocked(items, parent)).toBe(false)
    expect(isLockedParent(items, parent)).toBe(true)
  })

  it('unlocks when every child has graduatedAt', () => {
    const graduated = {
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 3,
      nextReviewAt: '2026-11-16T00:00:00.000Z',
      fluency: {
        graduatedAt: '2026-11-10T00:00:00.000Z',
        fastDays: ['2026-11-01', '2026-11-05', '2026-11-10'],
      },
    }
    const items = [
      parent,
      entry('c1', { parentId: 'p', practiceStats: graduated }),
      entry('c2', { parentId: 'p', practiceStats: graduated }),
    ]
    expect(isParentUnlocked(items, parent)).toBe(true)
    expect(isLockedParent(items, parent)).toBe(false)
  })

  it('treats parent with no children as unlocked for queue purposes', () => {
    expect(isLockedParent([parent], parent)).toBe(false)
    expect(childrenOf([parent], 'p')).toEqual([])
  })
})

describe('parentChunkStatus', () => {
  it('returns progress labels for parents with children', () => {
    const parent = entry('p', {
      translation: '这是一段比较长的中文内容用来练习。',
    })
    const items = [parent, entry('c', { parentId: 'p' })]
    expect(parentChunkStatus(items, parent)).toBe('Chunks in progress')
  })
})

describe('eligibleForChunkSuggest', () => {
  it('requires long en→zh without existing children', () => {
    const longZh =
      '这是一段比较长的中文内容用来练习记忆的句子，还需要再多几个汉字才能达到四十个字的长度要求。'
    expect(zhCharLength(longZh)).toBeGreaterThanOrEqual(MIN_CHUNKABLE_ZH_CHARS)
    const parent = entry('p', { translation: longZh })
    expect(eligibleForChunkSuggest(parent, [parent])).toBe(true)
    expect(
      eligibleForChunkSuggest(parent, [parent, entry('c', { parentId: 'p' })]),
    ).toBe(false)
    expect(
      eligibleForChunkSuggest(entry('short', { translation: '你好吗' }), [
        entry('short', { translation: '你好吗' }),
      ]),
    ).toBe(false)
  })
})