import { describe, expect, it } from 'vitest'
import type { PhrasebookEntry } from '@mindyourlanguage/shared'
import {
  buildPracticeQueue,
  practiceEmptyMessage,
  resolvePracticeEntry,
} from './practice-queue'

function entry(id: string, patch: Partial<PhrasebookEntry> = {}): PhrasebookEntry {
  return {
    id,
    translationId: id,
    sourceText: 'Hello',
    sourceLang: 'en',
    targetLang: 'zh',
    translation: '你好',
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
    tags: [],
    notes: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    ...patch,
  }
}

describe('buildPracticeQueue', () => {
  it('keeps only en→zh entries in due mode', () => {
    const items = [
      entry('zh-en', { sourceLang: 'zh', targetLang: 'en' }),
      entry('en-zh'),
    ]
    expect(buildPracticeQueue(items, 'due', '').map((row) => row.id)).toEqual([
      'en-zh',
    ])
  })
})

describe('resolvePracticeEntry', () => {
  const queue = [entry('a'), entry('b')]

  it('returns the pinned entry in speed mode after a completed session', () => {
    const pinned = entry('a', {
      practiceStats: {
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 1,
        nextReviewAt: '2026-08-01T00:00:00.000Z',
        fluency: { fastDays: ['2026-08-01'], lastSessionAt: '2026-08-01T00:00:00.000Z' },
      },
    })
    const allItems = [pinned, entry('b')]

    expect(
      resolvePracticeEntry('speed', [entry('b')], 0, allItems, 'a'),
    ).toEqual(pinned)
  })
})

describe('practiceEmptyMessage', () => {
  it('explains speed when nothing is eligible yet', () => {
    expect(practiceEmptyMessage('speed', [], '')).toContain('recall a phrase once')
  })
})

describe('locked parent gating', () => {
  const parent = entry('parent', {
    sourceText: 'Long English',
    translation: '这是一段比较长的中文内容用来练习。',
    practiceStats: {
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 1,
      nextReviewAt: '2026-01-01T00:00:00.000Z',
    },
  })
  const child = entry('child', {
    parentId: 'parent',
    sourceText: 'One idea',
    translation: '一个意思',
    practiceStats: {
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 1,
      nextReviewAt: '2026-01-01T00:00:00.000Z',
    },
  })

  it('excludes locked parents from due and speed but keeps them in all', () => {
    const items = [parent, child]
    expect(buildPracticeQueue(items, 'due', '').map((row) => row.id)).toEqual([
      'child',
    ])
    expect(buildPracticeQueue(items, 'speed', '').map((row) => row.id)).toEqual([
      'child',
    ])
    expect(
      buildPracticeQueue(items, 'all', '')
        .map((row) => row.id)
        .sort(),
    ).toEqual(['child', 'parent'])
  })

  it('includes unlocked parents in due', () => {
    const graduatedChild = {
      ...child,
      practiceStats: {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 3,
        nextReviewAt: '2026-01-01T00:00:00.000Z',
        fluency: {
          graduatedAt: '2026-11-10T00:00:00.000Z',
          fastDays: ['2026-11-01', '2026-11-05', '2026-11-10'],
        },
      },
    }
    const items = [parent, graduatedChild]
    expect(buildPracticeQueue(items, 'due', '').map((row) => row.id)).toEqual([
      'parent',
    ])
  })
})

describe('practiceEmptyMessage locked parents', () => {
  it('mentions chunks when due is empty but locked parents exist', () => {
    const parent = entry('parent', {
      translation: '这是一段比较长的中文内容用来练习。',
      practiceStats: {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: '2099-01-01T00:00:00.000Z',
      },
    })
    const child = entry('child', {
      parentId: 'parent',
      practiceStats: {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: '2099-01-01T00:00:00.000Z',
      },
    })
    expect(practiceEmptyMessage('due', [parent, child], '')).toMatch(/chunk/i)
  })
})
