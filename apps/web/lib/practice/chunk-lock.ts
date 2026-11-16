import type { PhrasebookEntry } from '@mindyourlanguage/shared'

export const MIN_CHUNKABLE_ZH_CHARS = 40

const HAN = /\p{Script=Han}/gu

export function zhCharLength(text: string): number {
  return (text.match(HAN) ?? []).length
}

export function childrenOf(
  items: PhrasebookEntry[],
  parentId: string,
): PhrasebookEntry[] {
  return items.filter((item) => item.parentId === parentId)
}

export function hasChildren(
  items: PhrasebookEntry[],
  parentId: string,
): boolean {
  return items.some((item) => item.parentId === parentId)
}

/** True when the entry has children and every child has fluency.graduatedAt. */
export function isParentUnlocked(
  items: PhrasebookEntry[],
  parent: PhrasebookEntry,
): boolean {
  const kids = childrenOf(items, parent.id)
  if (kids.length === 0) return true
  return kids.every((child) => Boolean(child.practiceStats?.fluency?.graduatedAt))
}

/** Parents with children that are not yet all graduated. */
export function isLockedParent(
  items: PhrasebookEntry[],
  entry: PhrasebookEntry,
): boolean {
  if (!hasChildren(items, entry.id)) return false
  return !isParentUnlocked(items, entry)
}

export function parentChunkStatus(
  items: PhrasebookEntry[],
  entry: PhrasebookEntry,
): string | null {
  if (!hasChildren(items, entry.id)) return null
  return isParentUnlocked(items, entry)
    ? 'Unlocked — full paragraph ready'
    : 'Chunks in progress'
}

export function eligibleForChunkSuggest(
  entry: Pick<
    PhrasebookEntry,
    'id' | 'translation' | 'sourceLang' | 'targetLang'
  >,
  items: PhrasebookEntry[],
  minZhChars: number = MIN_CHUNKABLE_ZH_CHARS,
): boolean {
  if (entry.sourceLang !== 'en' || entry.targetLang !== 'zh') return false
  if (zhCharLength(entry.translation) < minZhChars) return false
  if (hasChildren(items, entry.id)) return false
  return true
}