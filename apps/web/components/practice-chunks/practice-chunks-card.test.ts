import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PracticeChunksCard } from './practice-chunks-card'

describe('PracticeChunksCard', () => {
  it('renders title when suggestions exist', () => {
    const html = renderToStaticMarkup(
      createElement(PracticeChunksCard, {
        items: [{ english: 'One idea', chinese: '一个意思' }],
        characterSet: 'simplified',
        onSaveSelected: vi.fn(),
      }),
    )
    expect(html).toContain('Practice chunks')
  })
})