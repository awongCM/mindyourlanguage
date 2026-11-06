import type {
  CharacterSet,
  LearnableSuggestion,
} from "@mindyourlanguage/shared";
import { formatLearnableNotes } from "@/lib/learnables-shared";
import { createInitialPracticeStats } from "@/lib/practice/srs";
import {
  createPhrasebookEntry,
  isChineseAlreadySaved,
  usePhrasebookStore,
} from "@/lib/stores/phrasebook";

/** Turn one suggested learnable into a phrasebook / SRS card. */
export function createLearnablePhrasebookEntry(
  item: LearnableSuggestion,
  characterSet: CharacterSet,
) {
  return createPhrasebookEntry({
    translationId: null,
    sourceText: item.gloss,
    sourceLang: "en",
    targetLang: "zh",
    translation: item.chinese,
    characterSet,
    dictionaryMatches: [],
    segments: [],
    tags: [item.kind],
    notes: formatLearnableNotes(item),
    practiceStats: createInitialPracticeStats(),
  });
}

/**
 * Saves only Chinese text that is not already in the phrasebook.
 * Returns how many new cards were added.
 */
export function saveNewLearnables(
  items: LearnableSuggestion[],
  characterSet: CharacterSet,
): number {
  const { add } = usePhrasebookStore.getState();
  let savedCount = 0;

  for (const item of items) {
    const currentItems = usePhrasebookStore.getState().items;
    if (isChineseAlreadySaved(currentItems, item.chinese)) continue;
    add(createLearnablePhrasebookEntry(item, characterSet));
    savedCount += 1;
  }

  return savedCount;
}
