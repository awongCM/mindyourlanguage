import type { FluencyStats, PhrasebookEntry, PracticeStats } from '@mindyourlanguage/shared'
import { toSimplifiedChars } from '@/lib/characters'

/** Shrinking limits for the three passes of one speed session. */
export const SPEED_LIMITS_MS = [10000, 7000, 5000] as const

export const GRADUATION_FAST_DAYS = 3
export const GRADUATION_SPAN_DAYS = 6
export const KEEP_WARM_DAYS = 30

const MS_PER_DAY = 86_400_000
const STRIPPED = /[\s\p{P}\p{S}]+/gu

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function normalizeProduction(text: string): string {
  return toSimplifiedChars(text.normalize('NFKC')).replace(STRIPPED, '').toLowerCase()
}

export function attemptMatches(
  attempt: string,
  expected: { translation: string; traditional?: string },
): boolean {
  const normalizedAttempt = normalizeProduction(attempt)
  if (!normalizedAttempt) return false

  const savedForms = [expected.translation, expected.traditional].filter(
    (value): value is string => Boolean(value?.trim()),
  )
  return savedForms.some(
    (saved) => normalizeProduction(saved) === normalizedAttempt,
  )
}

export function evaluateSpeedAttempt(input: {
  attempt: string
  translation: string
  traditional?: string
  elapsedMs: number
  limitMs: number
}): 'pass' | 'timeout' | 'mismatch' {
  if (input.elapsedMs > input.limitMs) return 'timeout'
  return attemptMatches(input.attempt, {
    translation: input.translation,
    traditional: input.traditional,
  })
    ? 'pass'
    : 'mismatch'
}

function calendarSpanDays(fastDays: string[]): number {
  if (fastDays.length < 2) return 0
  const sorted = [...fastDays].sort()
  const firstDay = Date.parse(`${sorted[0]}T00:00:00.000Z`)
  const lastDay = Date.parse(`${sorted.at(-1)!}T00:00:00.000Z`)
  return Math.round((lastDay - firstDay) / MS_PER_DAY)
}

function meetsGraduationRule(fastDays: string[]): boolean {
  const uniqueDays = new Set(fastDays).size
  return uniqueDays >= GRADUATION_FAST_DAYS && calendarSpanDays(fastDays) >= GRADUATION_SPAN_DAYS
}

function appendFastDay(fastDays: string[], day: string): string[] {
  if (fastDays.includes(day)) return fastDays
  return [...fastDays, day].sort()
}

function buildFluencyStats(
  prior: FluencyStats | undefined,
  now: Date,
): FluencyStats {
  const fastDays = appendFastDay(prior?.fastDays ?? [], utcDay(now))
  const graduatedAt =
    prior?.graduatedAt ?? (meetsGraduationRule(fastDays) ? now.toISOString() : undefined)

  return {
    fastDays,
    lastSessionAt: now.toISOString(),
    ...(graduatedAt ? { graduatedAt } : {}),
  }
}

export function applySpeedSession(stats: PracticeStats, now: Date = new Date()): PracticeStats {
  return {
    ...stats,
    fluency: buildFluencyStats(stats.fluency, now),
  }
}

export function quietDays(stats: PracticeStats | undefined, now: Date): number {
  const fastDays = stats?.fluency?.fastDays
  if (!fastDays?.length) return Number.POSITIVE_INFINITY

  const lastFastDay = [...fastDays].sort().at(-1)!
  const lastMs = Date.parse(`${lastFastDay}T00:00:00.000Z`)
  const todayMs = Date.parse(`${utcDay(now)}T00:00:00.000Z`)
  return Math.round((todayMs - lastMs) / MS_PER_DAY)
}

export function isKeepWarm(stats: PracticeStats, now: Date = new Date()): boolean {
  if (!stats.fluency?.graduatedAt) return false
  return quietDays(stats, now) >= KEEP_WARM_DAYS
}

function belongsInSpeedQueue(entry: PhrasebookEntry, now: Date): boolean {
  const stats = entry.practiceStats
  if (!stats) return false

  if (stats.fluency?.graduatedAt) return isKeepWarm(stats, now)

  const fastDayCount = stats.fluency?.fastDays.length ?? 0
  return stats.repetitions >= 1 || fastDayCount > 0
}

function speedQueueRank(entry: PhrasebookEntry, now: Date): number {
  const stats = entry.practiceStats
  if (!stats) return 2

  if (isKeepWarm(stats, now)) return 0
  return 1
}

export function getSpeedEntries(
  entries: PhrasebookEntry[],
  now: Date = new Date(),
): PhrasebookEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.sourceLang === 'en' &&
        entry.targetLang === 'zh' &&
        belongsInSpeedQueue(entry, now),
    )
    .sort((left, right) => {
      const rankDiff =
        speedQueueRank(left, now) - speedQueueRank(right, now)
      if (rankDiff !== 0) return rankDiff

      const leftFastDays = left.practiceStats?.fluency?.fastDays.length ?? 0
      const rightFastDays = right.practiceStats?.fluency?.fastDays.length ?? 0
      return rightFastDays - leftFastDays
    })
}

function graduatedStatus(stats: PracticeStats, now: Date): string {
  if (isKeepWarm(stats, now)) {
    return `Quiet for ${quietDays(stats, now)} days. A fast session keeps it in the speaking set.`
  }
  return 'In your speaking set. The review card is paused until it has been quiet for about a month.'
}

function buildingFastDaysStatus(fastDayCount: number, fastDays: string[]): string {
  if (fastDayCount === 0) {
    return `No fast days yet. ${GRADUATION_FAST_DAYS} fast days, with the first and latest at least ${GRADUATION_SPAN_DAYS} days apart, let this card rest.`
  }
  if (fastDayCount === 1) {
    return `Fast day 1 of ${GRADUATION_FAST_DAYS}. Practice again on a later day. The first and latest need to be at least ${GRADUATION_SPAN_DAYS} days apart.`
  }

  const span = calendarSpanDays(fastDays)
  const dayWord = span === 1 ? 'day' : 'days'
  return `Fast days ${fastDayCount} of ${GRADUATION_FAST_DAYS}. The first and latest are ${span} ${dayWord} apart. They need ${GRADUATION_SPAN_DAYS}.`
}

export function fluencyStatusText(
  stats: PracticeStats | undefined,
  now: Date = new Date(),
): string {
  if (stats?.fluency?.graduatedAt) return graduatedStatus(stats, now)

  const fastDays = stats?.fluency?.fastDays ?? []
  return buildingFastDaysStatus(fastDays.length, fastDays)
}
