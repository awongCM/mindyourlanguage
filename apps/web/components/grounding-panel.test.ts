import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DictionaryEntry } from '@mindyourlanguage/shared'
import { GroundingPanel } from './grounding-panel'

describe('GroundingPanel', () => {
  it('renders an empty message when no dictionary entries match', () => {
    const html = renderToStaticMarkup(
      createElement(GroundingPanel, { entries: [] }),
    )

    expect(html).toContain('aria-label="Dictionary grounding"')
    expect(html).toContain('No dictionary matches for this translation.')
  })

  it('renders dictionary entries with pinyin and definitions', () => {
    const entries: DictionaryEntry[] = [
      {
        simplified: '认识',
        traditional: '認識',
        pinyin: 'ren4 shi5',
        definitions: ['to know', 'to recognize'],
      },
      {
        simplified: '你',
        traditional: '你',
        pinyin: 'ni3',
        definitions: ['you'],
      },
    ]

    const html = renderToStaticMarkup(
      createElement(GroundingPanel, { entries }),
    )

    expect(html).toContain('Dictionary grounding')
    expect(html).toContain('认识')
    expect(html).toContain('認識')
    expect(html).toContain('ren4 shi5')
    expect(html).toContain('to know; to recognize')
    expect(html).toContain('ni3')
    expect(html).toContain('you')
  })
})
