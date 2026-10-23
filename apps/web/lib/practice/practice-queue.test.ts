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
