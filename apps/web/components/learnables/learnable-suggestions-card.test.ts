import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LearnableSuggestionsCard } from './learnable-suggestions-card'

const items = [
  {
    chinese: '认识',
    gloss: 'to get to know',
    kind: 'verb' as const,
    exampleChinese: '很高兴认识你。',
    exampleEnglish: 'Nice to meet you.',
  },
]

describe('LearnableSuggestionsCard', () => {
  it('renders suggestions and save action', () => {
    const html = renderToStaticMarkup(
      createElement(LearnableSuggestionsCard, {
        items,
        characterSet: 'simplified',
        onSaveSelected: vi.fn(),
      }),
    )

    expect(html).toContain('New bits to learn')
    expect(html).toContain('认识')
    expect(html).toContain('to get to know')
    expect(html).toContain('很高兴认识你。')
    expect(html).toContain('Nice to meet you.')
    expect(html).toContain('Save selected')
  })

  it('shows loading copy while fetching', () => {
    const html = renderToStaticMarkup(
      createElement(LearnableSuggestionsCard, {
        items: [],
        loading: true,
        characterSet: 'simplified',
        onSaveSelected: vi.fn(),
      }),
    )

    expect(html).toContain('Finding new bits to learn…')
  })

  it('converts chinese to traditional when requested', () => {
    const html = renderToStaticMarkup(
      createElement(LearnableSuggestionsCard, {
        items: [
          {
            chinese: '认识',
            gloss: 'to get to know',
            kind: 'verb',
            exampleChinese: '很高兴认识你。',
            exampleEnglish: 'Nice to meet you.',
          },
        ],
        characterSet: 'traditional',
        onSaveSelected: vi.fn(),
      }),
    )

    expect(html).toContain('認識')
  })
})
