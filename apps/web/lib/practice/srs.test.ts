import { describe, expect, it } from 'vitest'
import type { PhrasebookEntry } from '@mindyourlanguage/shared'
import {
  createInitialPracticeStats,
  getDueEntries,
  isDue,
  recordReview,
} from './srs'

describe('createInitialPracticeStats', () => {
  it('marks new cards due immediately with default ease', () => {
    const now = new Date('2026-08-02T10:00:00.000Z')
    const stats = createInitialPracticeStats(now)

    expect(stats.easeFactor).toBe(2.5)
    expect(stats.intervalDays).toBe(0)
    expect(stats.repetitions).toBe(0)
    expect(stats.nextReviewAt).toBe(now.toISOString())
  })
})

describe('recordReview', () => {
  const now = new Date('2026-08-02T10:00:00.000Z')

  it('resets progress on again and keeps the card due', () => {
    const prior = {
      easeFactor: 2.5,
      intervalDays: 6,
      repetitions: 3,
      nextReviewAt: '2026-08-01T10:00:00.000Z',
    }

    const next = recordReview(prior, 'again', now)

    expect(next.repetitions).toBe(0)
    expect(next.intervalDays).toBe(0)
    expect(next.easeFactor).toBe(2.3)
    expect(next.nextReviewAt).toBe(now.toISOString())
    expect(next.lastReviewedAt).toBe(now.toISOString())
  })

  it('schedules first good review for 1 day later', () => {
    const next = recordReview(createInitialPracticeStats(now), 'good', now)

    expect(next.repetitions).toBe(1)
    expect(next.intervalDays).toBe(1)
    expect(next.nextReviewAt).toBe('2026-08-03T10:00:00.000Z')
  })

  it('schedules second good review for 6 days later', () => {
    const afterFirst = recordReview(createInitialPracticeStats(now), 'good', now)
    const day2 = new Date('2026-08-03T10:00:00.000Z')
    const afterSecond = recordReview(afterFirst, 'good', day2)

    expect(afterSecond.repetitions).toBe(2)
    expect(afterSecond.intervalDays).toBe(6)
    expect(afterSecond.nextReviewAt).toBe('2026-08-09T10:00:00.000Z')
  })

  it('applies ease and interval multipliers on later reviews', () => {
    const matured = {
      easeFactor: 2.5,
      intervalDays: 6,
      repetitions: 2,
      nextReviewAt: now.toISOString(),
    }

    const easy = recordReview(matured, 'easy', now)
    expect(easy.easeFactor).toBe(2.65)
    expect(easy.intervalDays).toBe(Math.round(6 * 2.65 * 1.3))
    expect(easy.repetitions).toBe(3)

    const hard = recordReview(matured, 'hard', now)
    expect(hard.easeFactor).toBe(2.35)
    expect(hard.intervalDays).toBe(Math.round(6 * 1.2))
  })

  it('never drops ease below 1.3', () => {
    const low = {
      easeFactor: 1.35,
      intervalDays: 1,
      repetitions: 1,
      nextReviewAt: now.toISOString(),
    }

    expect(recordReview(low, 'again', now).easeFactor).toBe(1.3)
    expect(recordReview(low, 'hard', now).easeFactor).toBe(1.3)
  })
})

describe('isDue / getDueEntries', () => {
  const now = new Date('2026-08-02T12:00:00.000Z')

  function entry(
    id: string,
    nextReviewAt?: string,
  ): PhrasebookEntry {
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
      createdAt: now.toISOString(),
      ...(nextReviewAt
        ? {
            practiceStats: {
              easeFactor: 2.5,
              intervalDays: 1,
              repetitions: 1,
              nextReviewAt,
            },
          }
        : {}),
    }
  }

  it('treats missing practiceStats as due', () => {
    expect(isDue(undefined, now)).toBe(true)
  })

  it('filters due entries by nextReviewAt', () => {
    const items = [
      entry('due', '2026-08-02T11:00:00.000Z'),
      entry('later', '2026-08-03T12:00:00.000Z'),
      entry('fresh'),
    ]

    const due = getDueEntries(items, now)
    expect(due.map((item) => item.id)).toEqual(['due', 'fresh'])
  })
})
