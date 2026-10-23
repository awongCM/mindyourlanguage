import { describe, expect, it } from 'vitest'
import type { PhrasebookEntry, PracticeStats } from '@mindyourlanguage/shared'
import { createInitialPracticeStats } from './srs'
import {
  applySpeedSession,
  attemptMatches,
  evaluateSpeedAttempt,
  fluencyStatusText,
  getSpeedEntries,
  isKeepWarm,
  SPEED_LIMITS_MS,
} from './fluency'

const day = (isoDay: string) => new Date(`${isoDay}T12:00:00.000Z`)

function statsWith(fluency?: PracticeStats['fluency'], repetitions = 1): PracticeStats {
  return {
    easeFactor: 2.5,
    intervalDays: 1,
    repetitions,
    nextReviewAt: '2026-08-01T00:00:00.000Z',
    fluency,
  }
}

function entry(id: string, practiceStats?: PracticeStats): PhrasebookEntry {
  return {
    id,
    translationId: id,
    sourceText: 'Nice to meet you',
    sourceLang: 'en',
    targetLang: 'zh',
    translation: '你好，很高兴认识你。',
    traditional: '你好，很高興認識你。',
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
    tags: [],
    notes: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    practiceStats,
  }
}

describe('attemptMatches', () => {
  const expected = {
    translation: '你好，很高兴认识你。',
    traditional: '你好，很高興認識你。',
  }

  it('accepts the saved wording without punctuation or spaces', () => {
    expect(attemptMatches('你好很高兴认识你', expected)).toBe(true)
  })

  it('accepts the traditional form of the saved phrase', () => {
    expect(attemptMatches('你好，很高興認識你。', expected)).toBe(true)
  })

  it('rejects a shorter fragment of the phrase', () => {
    expect(attemptMatches('你好', expected)).toBe(false)
  })

  it('rejects an empty attempt', () => {
    expect(attemptMatches('   ', expected)).toBe(false)
  })
})

describe('evaluateSpeedAttempt', () => {
  it('passes a matching attempt submitted inside the limit', () => {
    expect(
      evaluateSpeedAttempt({
        attempt: '你好很高兴认识你',
        translation: '你好，很高兴认识你。',
        elapsedMs: 3000,
        limitMs: SPEED_LIMITS_MS[0],
      }),
    ).toBe('pass')
  })

  it('marks a late match as a timeout', () => {
    expect(
      evaluateSpeedAttempt({
        attempt: '你好很高兴认识你',
        translation: '你好，很高兴认识你。',
        elapsedMs: SPEED_LIMITS_MS[0] + 1,
        limitMs: SPEED_LIMITS_MS[0],
      }),
    ).toBe('timeout')
  })

  it('marks a wrong attempt inside the limit as a mismatch', () => {
    expect(
      evaluateSpeedAttempt({
        attempt: '再见',
        translation: '你好，很高兴认识你。',
        elapsedMs: 1000,
        limitMs: SPEED_LIMITS_MS[0],
      }),
    ).toBe('mismatch')
  })
})

describe('applySpeedSession', () => {
  it('records one fast day per calendar day', () => {
    const first = applySpeedSession(
      createInitialPracticeStats(day('2026-08-01')),
      day('2026-08-01'),
    )
    const second = applySpeedSession(first, new Date('2026-08-01T18:00:00.000Z'))

    expect(second.fluency?.fastDays).toEqual(['2026-08-01'])
    expect(second.fluency?.lastSessionAt).toBe('2026-08-01T18:00:00.000Z')
    expect(second.fluency?.graduatedAt).toBeUndefined()
  })

  it('keeps the card active when three fast days are packed into one week', () => {
    let stats = createInitialPracticeStats(day('2026-08-01'))
    for (const iso of ['2026-08-01', '2026-08-02', '2026-08-03']) {
      stats = applySpeedSession(stats, day(iso))
    }

    expect(stats.fluency?.fastDays).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ])
    expect(stats.fluency?.graduatedAt).toBeUndefined()
  })

  it('graduates after three fast days spanning at least six days', () => {
    let stats: PracticeStats = {
      ...createInitialPracticeStats(day('2026-08-01')),
      intervalDays: 6,
      repetitions: 2,
    }
    for (const iso of ['2026-08-01', '2026-08-02', '2026-08-07']) {
      stats = applySpeedSession(stats, day(iso))
    }

    expect(stats.fluency?.graduatedAt).toBe('2026-08-07T12:00:00.000Z')
    expect(stats.intervalDays).toBe(6)
    expect(stats.repetitions).toBe(2)
  })

  it('keeps an existing graduation when a later speed session is recorded', () => {
    const graduated = applySpeedSession(
      statsWith({
        fastDays: ['2026-08-01', '2026-08-03', '2026-08-07'],
        graduatedAt: '2026-08-07T12:00:00.000Z',
        lastSessionAt: '2026-08-07T12:00:00.000Z',
      }),
      day('2026-09-10'),
    )

    expect(graduated.fluency?.graduatedAt).toBe('2026-08-07T12:00:00.000Z')
    expect(graduated.fluency?.fastDays).toContain('2026-09-10')
  })
})

describe('speed queue', () => {
  const now = day('2026-09-10')

  it('orders a monthly check ahead of phrases still building fast days', () => {
    const items = [
      entry('new'),
      entry('building', statsWith({ fastDays: ['2026-09-01'], lastSessionAt: '2026-09-01T00:00:00.000Z' })),
      entry(
        'quiet',
        statsWith({
          fastDays: ['2026-08-01', '2026-08-04', '2026-08-08'],
          graduatedAt: '2026-08-08T00:00:00.000Z',
          lastSessionAt: '2026-08-08T00:00:00.000Z',
        }),
      ),
      entry(
        'fresh-speaking',
        statsWith({
          fastDays: ['2026-09-01', '2026-09-04', '2026-09-08'],
          graduatedAt: '2026-09-08T00:00:00.000Z',
          lastSessionAt: '2026-09-08T00:00:00.000Z',
        }),
      ),
      entry('recalled', statsWith(undefined, 1)),
    ]

    expect(isKeepWarm(items[2].practiceStats!, now)).toBe(true)
    expect(getSpeedEntries(items, now).map((item) => item.id)).toEqual([
      'quiet',
      'building',
      'recalled',
    ])
  })
})

describe('fluencyStatusText', () => {
  it('describes how a phrase leaves the review queue', () => {
    const text = fluencyStatusText(
      statsWith({ fastDays: ['2026-08-01', '2026-08-02'], lastSessionAt: '2026-08-02T00:00:00.000Z' }),
      day('2026-08-02'),
    )

    expect(text).toContain('2 of 3')
    expect(text).toContain('6')
  })

  it('describes a paused card after graduation', () => {
    const text = fluencyStatusText(
      statsWith({
        fastDays: ['2026-08-01', '2026-08-04', '2026-08-07'],
        graduatedAt: '2026-08-07T12:00:00.000Z',
        lastSessionAt: '2026-08-07T12:00:00.000Z',
      }),
      day('2026-08-07'),
    )

    expect(text).toContain('speaking set')
  })
})
