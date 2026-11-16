import type {
  CharacterSet,
  PhrasebookEntry,
  PracticeChunkSuggestion,
} from '@mindyourlanguage/shared'
import { createInitialPracticeStats } from '@/lib/practice/srs'
import {
  createPhrasebookEntry,
  isChineseAlreadySaved,
  usePhrasebookStore,
} from '@/lib/stores/phrasebook'
import { phrasebookFieldsFromChunk } from './parse'

export type PracticeChunkParentInput = Omit<
  PhrasebookEntry,
  'id' | 'createdAt' | 'tags' | 'notes' | 'parentId'
> & {
  tags?: string[]
  notes?: string
  id?: string
}

export function savePracticeChunksToPhrasebook(input: {
  parent: PracticeChunkParentInput
  chunks: PracticeChunkSuggestion[]
  characterSet: CharacterSet
}): { parentId: string; savedChunkCount: number } {
  const { add } = usePhrasebookStore.getState()
  const items = usePhrasebookStore.getState().items

  let parentId = input.parent.id
  if (parentId && items.some((item) => item.id === parentId)) {
    // Reuse existing parent row.
  } else {
    const parentEntry = createPhrasebookEntry({
      ...input.parent,
      tags: input.parent.tags ?? [],
      notes: input.parent.notes ?? '',
      practiceStats:
        input.parent.practiceStats ?? createInitialPracticeStats(),
    })
    add(parentEntry)
    parentId = parentEntry.id
  }

  let savedChunkCount = 0
  for (const chunk of input.chunks) {
    if (isChineseAlreadySaved(usePhrasebookStore.getState().items, chunk.chinese)) {
      continue
    }
    add(
      createPhrasebookEntry({
        ...phrasebookFieldsFromChunk(chunk, input.characterSet, parentId!),
        dictionaryMatches: [],
        segments: [],
        practiceStats: createInitialPracticeStats(),
      }),
    )
    savedChunkCount += 1
  }

  return { parentId: parentId!, savedChunkCount }
}