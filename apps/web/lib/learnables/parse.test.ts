import { describe, expect, it } from 'vitest'
import { createInitialPracticeStats } from '@/lib/practice/srs'
import { createPhrasebookEntry } from '@/lib/stores/phrasebook'
import {
  filterNewLearnables,
  MAX_LEARNABLE_SUGGESTIONS,
  parseLearnablesResponse,
  phrasebookFieldsFromLearnable,
} from './parse'

const sample = {
  chinese: '认识',
  gloss: 'to get to know',
  kind: 'verb' as const,
  exampleChinese: '很高兴认识你。',
  exampleEnglish: 'Nice to meet you.',
}

describe('filterNewLearnables', () => {
  it('drops known chinese and caps at three', () => {
    const items = [
      sample,
      { ...sample, chinese: '高兴', gloss: 'happy', kind: 'noun' as const },
      { ...sample, chinese: '很', gloss: 'very', kind: 'phrase' as const },
      { ...sample, chinese: '你', gloss: 'you', kind: 'noun' as const },
      { ...sample, chinese: '认识', gloss: 'dup' },
    ]

    const filtered = filterNewLearnables(items, ['高兴', ' 你 '])
    expect(filtered).toHaveLength(2)
    expect(filtered.map((item) => item.chinese)).toEqual(['认识', '很'])
    expect(MAX_LEARNABLE_SUGGESTIONS).toBe(3)
  })
})

describe('parseLearnablesResponse', () => {
  it('parses valid items and filters known', () => {
    const parsed = parseLearnablesResponse(
      JSON.stringify({
        items: [
          sample,
          {
            chinese: '你好',
            gloss: 'hello',
            kind: 'phrase',
            exampleChinese: '你好吗？',
            exampleEnglish: 'How are you?',
          },
          { chinese: '坏', gloss: 'bad', kind: 'adjective' },
        ],
      }),
      ['你好'],
    )

    expect(parsed).toEqual([sample])
  })

  it('returns empty for invalid JSON', () => {
    expect(parseLearnablesResponse('not-json')).toEqual([])
  })

  it('caps at three suggestions', () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      chinese: `词${index}`,
      gloss: `gloss ${index}`,
      kind: 'noun',
      exampleChinese: `例${index}`,
      exampleEnglish: `ex ${index}`,
    }))

    expect(parseLearnablesResponse(JSON.stringify({ items }))).toHaveLength(3)
  })
})

describe('phrasebookFieldsFromLearnable', () => {
  it('maps a suggestion onto a due SRS phrasebook card', () => {
    const entry = createPhrasebookEntry({
      ...phrasebookFieldsFromLearnable(sample, 'simplified'),
      dictionaryMatches: [],
      segments: [],
      practiceStats: createInitialPracticeStats(),
    })

    expect(entry.translationId).toBeNull()
    expect(entry.sourceText).toBe('to get to know')
    expect(entry.translation).toBe('认识')
    expect(entry.tags).toEqual(['verb'])
    expect(entry.notes).toBe('很高兴认识你。\nNice to meet you.')
    expect(entry.practiceStats?.repetitions).toBe(0)
    expect(
      new Date(entry.practiceStats!.nextReviewAt).getTime(),
    ).toBeLessThanOrEqual(Date.now())
  })
})
