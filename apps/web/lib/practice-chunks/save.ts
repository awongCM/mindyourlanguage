import type {
  CharacterSet,
  PhrasebookEntry,
  PracticeChunkSuggestion,
} from '@mindyourlanguage/shared'
import { createInitialPracticeStats } from '@/lib/practice/srs'
import {
  createPhrasebookEntry,
  isChunkSavedForParent,
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
}): {
  parentId: string
  savedChunkCount: number
  skippedChunkCount: number
} {
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
  let skippedChunkCount = 0
  for (const chunk of input.chunks) {
    const currentItems = usePhrasebookStore.getState().items
    if (isChunkSavedForParent(currentItems, chunk.chinese, parentId!)) {
      skippedChunkCount += 1
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

  return { parentId: parentId!, savedChunkCount, skippedChunkCount }
}