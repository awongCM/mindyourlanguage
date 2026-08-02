import type { PhrasebookEntry, PracticeStats, ReviewGrade } from '@mindyourlanguage/shared'

const MIN_EASE = 1.3
const DEFAULT_EASE = 2.5

export function createInitialPracticeStats(now: Date = new Date()): PracticeStats {
  return {
    easeFactor: DEFAULT_EASE,
    intervalDays: 0,
    repetitions: 0,
    nextReviewAt: now.toISOString(),
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function recordReview(
  stats: PracticeStats,
  grade: ReviewGrade,
  now: Date = new Date(),
): PracticeStats {
  let { easeFactor, intervalDays, repetitions } = stats

  if (grade === 'again') {
    repetitions = 0
    intervalDays = 0
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2)
  } else {
    if (grade === 'hard') {
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.15)
    } else if (grade === 'easy') {
      easeFactor += 0.15
    }

    if (repetitions === 0) {
      intervalDays = grade === 'easy' ? 4 : grade === 'hard' ? 1 : 1
    } else if (repetitions === 1) {
      intervalDays = grade === 'easy' ? 7 : grade === 'hard' ? 3 : 6
    } else {
      const multiplier =
        grade === 'hard' ? 1.2 : grade === 'easy' ? easeFactor * 1.3 : easeFactor
      intervalDays = Math.max(1, Math.round(intervalDays * multiplier))
    }

    repetitions += 1
  }

  return {
    easeFactor,
    intervalDays,
    repetitions,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: addDays(now, intervalDays).toISOString(),
  }
}

export function isDue(
  stats: PracticeStats | undefined,
  now: Date = new Date(),
): boolean {
  if (!stats) return true
  return new Date(stats.nextReviewAt).getTime() <= now.getTime()
}

export function getDueEntries(
  entries: PhrasebookEntry[],
  now: Date = new Date(),
): PhrasebookEntry[] {
  return entries.filter((entry) => isDue(entry.practiceStats, now))
}
