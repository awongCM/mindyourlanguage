import type { PhrasebookEntry, PracticeStats } from '@mindyourlanguage/shared'
import { toSimplifiedChars } from '@/lib/characters'

/** Shrinking limits for the three passes of one speed session. */
export const SPEED_LIMITS_MS = [10000, 7000, 5000] as const

export const GRADUATION_FAST_DAYS = 3
export const GRADUATION_SPAN_DAYS = 6
export const KEEP_WARM_DAYS = 30

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
  const given = normalizeProduction(attempt)
  if (!given) return false

  const targets = [expected.translation, expected.traditional].filter(
    (value): value is string => Boolean(value && value.trim()),
  )
  return targets.some((target) => normalizeProduction(target) === given)
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

function spanDays(fastDays: string[]): number {
  if (fastDays.length < 2) return 0
  const sorted = [...fastDays].sort()
  const first = Date.parse(`${sorted[0]}T00:00:00.000Z`)
  const last = Date.parse(`${sorted[sorted.length - 1]}T00:00:00.000Z`)
  return Math.round((last - first) / 86_400_000)
}

function canGraduate(fastDays: string[]): boolean {
  return new Set(fastDays).size >= GRADUATION_FAST_DAYS && spanDays(fastDays) >= GRADUATION_SPAN_DAYS
}

export function applySpeedSession(stats: PracticeStats, now: Date = new Date()): PracticeStats {
  const day = utcDay(now)
  const prior = stats.fluency?.fastDays ?? []
  const fastDays = prior.includes(day) ? [...prior] : [...prior, day].sort()
  const graduatedAt =
    stats.fluency?.graduatedAt ??
    (canGraduate(fastDays) ? now.toISOString() : undefined)

  return {
    ...stats,
    fluency: {
      fastDays,
      lastSessionAt: now.toISOString(),
      ...(graduatedAt ? { graduatedAt } : {}),
    },
  }
}

export function quietDays(stats: PracticeStats | undefined, now: Date): number {
  const days = stats?.fluency?.fastDays
  if (!days || days.length === 0) return Number.POSITIVE_INFINITY
  const sorted = [...days].sort()
  const lastMs = Date.parse(`${sorted[sorted.length - 1]}T00:00:00.000Z`)
  const nowMs = Date.parse(`${utcDay(now)}T00:00:00.000Z`)
  return Math.round((nowMs - lastMs) / 86_400_000)
}

export function isKeepWarm(stats: PracticeStats, now: Date = new Date()): boolean {
  if (!stats.fluency?.graduatedAt) return false
  return quietDays(stats, now) >= KEEP_WARM_DAYS
}

export function getSpeedEntries(
  entries: PhrasebookEntry[],
  now: Date = new Date(),
): PhrasebookEntry[] {
  return entries
    .filter((entry) => {
      if (entry.sourceLang !== 'en' || entry.targetLang !== 'zh') return false
      const stats = entry.practiceStats
      if (!stats) return false
      if (stats.fluency?.graduatedAt) return isKeepWarm(stats, now)
      const fastDays = stats.fluency?.fastDays.length ?? 0
      return stats.repetitions >= 1 || fastDays > 0
    })
    .sort((a, b) => {
      const aWarm = a.practiceStats && isKeepWarm(a.practiceStats, now) ? 0 : 1
      const bWarm = b.practiceStats && isKeepWarm(b.practiceStats, now) ? 0 : 1
      if (aWarm !== bWarm) return aWarm - bWarm
      const aDays = a.practiceStats?.fluency?.fastDays.length ?? 0
      const bDays = b.practiceStats?.fluency?.fastDays.length ?? 0
      return bDays - aDays
    })
}

export function fluencyStatusText(
  stats: PracticeStats | undefined,
  now: Date = new Date(),
): string {
  if (stats?.fluency?.graduatedAt) {
    if (isKeepWarm(stats, now)) {
      const quiet = quietDays(stats, now)
      return `Quiet for ${quiet} days. A fast session keeps it in the speaking set.`
    }
    return 'In your speaking set. The review card is paused until it has been quiet for about a month.'
  }

  const count = stats?.fluency?.fastDays.length ?? 0
  if (count === 0) {
    return `No fast days yet. ${GRADUATION_FAST_DAYS} fast days, with the first and latest at least ${GRADUATION_SPAN_DAYS} days apart, let this card rest.`
  }
  if (count === 1) {
    return `Fast day 1 of ${GRADUATION_FAST_DAYS}. Practice again on a later day. The first and latest need to be at least ${GRADUATION_SPAN_DAYS} days apart.`
  }
  const span = spanDays(stats?.fluency?.fastDays ?? [])
  const dayWord = span === 1 ? 'day' : 'days'
  return `Fast days ${count} of ${GRADUATION_FAST_DAYS}. The first and latest are ${span} ${dayWord} apart. They need ${GRADUATION_SPAN_DAYS}.`
}
