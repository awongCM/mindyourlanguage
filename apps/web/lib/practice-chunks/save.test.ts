import { describe, expect, it, beforeEach } from 'vitest'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
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
})