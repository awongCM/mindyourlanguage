import type { PhrasebookEntry } from '@mindyourlanguage/shared'
import { isLockedParent } from '@/lib/practice/chunk-lock'
import { getSpeedEntries } from '@/lib/practice/fluency'
import { getDueEntries } from '@/lib/practice/srs'
import { filterPhrasebookByTag } from '@/lib/stores/phrasebook'

export type DrillMode = 'due' | 'speed' | 'all'

export function isEnToZh(entry: PhrasebookEntry): boolean {
  return entry.sourceLang === 'en' && entry.targetLang === 'zh'
}

function withoutLockedParents(
  items: PhrasebookEntry[],
  pool: PhrasebookEntry[],
): PhrasebookEntry[] {
  return pool.filter((entry) => !isLockedParent(items, entry))
}

/** Phrases shown for the active practice mode (after tag filter). */
export function buildPracticeQueue(
  items: PhrasebookEntry[],
  mode: DrillMode,
  tagFilter: string,
): PhrasebookEntry[] {
  const tagged = filterPhrasebookByTag(items, tagFilter)
  if (mode === 'speed') {
    return withoutLockedParents(items, getSpeedEntries(tagged))
  }
  const base = mode === 'due' ? getDueEntries(tagged) : tagged
  const enZh = base.filter(isEnToZh)
  if (mode === 'all') return enZh
  return withoutLockedParents(items, enZh)
}

/**
 * Speed mode drops a phrase from the queue as soon as a session completes.
 * Pin the entry until the learner taps Next so the success screen stays visible.
 */
export function resolvePracticeEntry(
  mode: DrillMode,
  queue: PhrasebookEntry[],
  queueIndex: number,
  allItems: PhrasebookEntry[],
  pinnedEntryId: string | null,
): PhrasebookEntry | undefined {
  if (queue.length === 0) return undefined
  const index = Math.min(queueIndex, queue.length - 1)
  const fromQueue = queue[index]
  if (mode !== 'speed') return fromQueue
  if (!pinnedEntryId) return fromQueue
  return allItems.find((item) => item.id === pinnedEntryId) ?? fromQueue
}

export function practiceEmptyMessage(
  mode: DrillMode,
  items: PhrasebookEntry[],
  tagFilter: string,
): string {
  if (tagFilter.trim() && filterPhrasebookByTag(items, tagFilter).length === 0) {
    return 'No phrases match that tag.'
  }
  if (mode === 'due') {
    const hasLockedParent = items.some(
      (entry) => isEnToZh(entry) && isLockedParent(items, entry),
    )
    if (hasLockedParent) {
      return 'Nothing due today. Full paragraphs unlock after their practice chunks graduate.'
    }
    return 'Nothing due today. Save phrases from Translate, or switch to All saved.'
  }
  if (mode === 'all') {
    return 'No phrasebook entries yet. Translate and save a phrase to start drilling.'
  }
  const hasGraduatedPhrase = items.some(
    (entry) => isEnToZh(entry) && entry.practiceStats?.fluency?.graduatedAt,
  )
  if (hasGraduatedPhrase) {
    return 'Your phrases are in the speaking set. They come back here after about a month so they stay fast.'
  }
  return 'Speed starts after you recall a phrase once. Grade a due card, then come back.'
}