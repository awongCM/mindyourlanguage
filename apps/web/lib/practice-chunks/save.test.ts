import { describe, expect, it, beforeEach } from 'vitest'
import {
  createPhrasebookEntry,
  usePhrasebookStore,
} from '@/lib/stores/phrasebook'
import { savePracticeChunksToPhrasebook } from './save'

describe('savePracticeChunksToPhrasebook', () => {
  beforeEach(() => {
    usePhrasebookStore.setState({ items: [] })
  })

  it('creates parent and children with parentId', () => {
    const { parentId, savedChunkCount } = savePracticeChunksToPhrasebook({
      parent: {
        translationId: 'tr-1',
        sourceText: 'Long paragraph',
        sourceLang: 'en',
        targetLang: 'zh',
        translation: '这是一段比较长的中文内容用来练习记忆的句子。',
        characterSet: 'simplified',
        dictionaryMatches: [],
        segments: [],
      },
      chunks: [
        { english: 'First', chinese: '第一段' },
        { english: 'Second', chinese: '第二段' },
      ],
      characterSet: 'simplified',
    })

    expect(savedChunkCount).toBe(2)
    const items = usePhrasebookStore.getState().items
    expect(items).toHaveLength(3)
    const parent = items.find((item) => item.id === parentId)
    expect(parent?.parentId).toBeUndefined()
    const children = items.filter((item) => item.parentId === parentId)
    expect(children).toHaveLength(2)
  })

  it('allows the same Chinese elsewhere but skips duplicates under one parent', () => {
    usePhrasebookStore.getState().add(
      createPhrasebookEntry({
        translationId: null,
        sourceText: 'Other',
        sourceLang: 'en',
        targetLang: 'zh',
        translation: '第一段',
        characterSet: 'simplified',
        dictionaryMatches: [],
        segments: [],
      }),
    )

    const first = savePracticeChunksToPhrasebook({
      parent: {
        translationId: 'tr-1',
        sourceText: 'Long',
        sourceLang: 'en',
        targetLang: 'zh',
        translation: '这是一段比较长的中文内容用来练习记忆的句子。',
        characterSet: 'simplified',
        dictionaryMatches: [],
        segments: [],
      },
      chunks: [
        { english: 'First', chinese: '第一段' },
        { english: 'Second', chinese: '第二段' },
      ],
      characterSet: 'simplified',
    })
    expect(first.savedChunkCount).toBe(2)

    const second = savePracticeChunksToPhrasebook({
      parent: {
        id: first.parentId,
        translationId: 'tr-1',
        sourceText: 'Long',
        sourceLang: 'en',
        targetLang: 'zh',
        translation: '这是一段比较长的中文内容用来练习记忆的句子。',
        characterSet: 'simplified',
        dictionaryMatches: [],
        segments: [],
      },
      chunks: [
        { english: 'First', chinese: '第一段' },
        { english: 'Third', chinese: '第三段' },
      ],
      characterSet: 'simplified',
    })
    expect(second.savedChunkCount).toBe(1)
    expect(second.skippedChunkCount).toBe(1)
    const children = usePhrasebookStore
      .getState()
      .items.filter((item) => item.parentId === first.parentId)
    expect(children).toHaveLength(3)
  })
})