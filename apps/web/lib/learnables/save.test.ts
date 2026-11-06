import { beforeEach, describe, expect, it } from 'vitest'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
import { saveLearnablesToPhrasebook } from './save'

const sample = {
  chinese: '认识',
  gloss: 'to get to know',
  kind: 'verb' as const,
  exampleChinese: '很高兴认识你。',
  exampleEnglish: 'Nice to meet you.',
}

describe('saveLearnablesToPhrasebook', () => {
  beforeEach(() => {
    usePhrasebookStore.setState({ items: [] })
  })

  it('adds new cards and skips chinese already saved', () => {
    expect(saveLearnablesToPhrasebook([sample], 'simplified')).toBe(1)
    expect(saveLearnablesToPhrasebook([sample], 'simplified')).toBe(0)
    expect(usePhrasebookStore.getState().items).toHaveLength(1)
    expect(usePhrasebookStore.getState().items[0]?.notes).toContain(
      '很高兴认识你。',
    )
  })
})
