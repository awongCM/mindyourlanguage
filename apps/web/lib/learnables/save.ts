import type {
  CharacterSet,
  LearnableSuggestion,
} from '@mindyourlanguage/shared'
import { createInitialPracticeStats } from '@/lib/practice/srs'
import {
  createPhrasebookEntry,
  isChineseAlreadySaved,
  usePhrasebookStore,
} from '@/lib/stores/phrasebook'
import { phrasebookFieldsFromLearnable } from './parse'

/**
 * Save selected learnables that are not already in the phrasebook.
 * Returns how many new SRS cards were added.
 */
export function saveLearnablesToPhrasebook(
  items: LearnableSuggestion[],
  characterSet: CharacterSet,
): number {
  const { add } = usePhrasebookStore.getState()
  let savedCount = 0

  for (const item of items) {
    if (
      isChineseAlreadySaved(usePhrasebookStore.getState().items, item.chinese)
    ) {
      continue
    }

    add(
      createPhrasebookEntry({
        ...phrasebookFieldsFromLearnable(item, characterSet),
        dictionaryMatches: [],
        segments: [],
        practiceStats: createInitialPracticeStats(),
      }),
    )
    savedCount += 1
  }

  return savedCount
}
