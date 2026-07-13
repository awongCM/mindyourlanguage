import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NativeAlternativeCard } from './native-alternative-card'

describe('NativeAlternativeCard', () => {
  it('renders the alternative, register label, and note', () => {
    const html = renderToStaticMarkup(
      createElement(NativeAlternativeCard, {
        alternative: '哈喽，很高兴认识你。',
        register: 'casual',
        note: 'More natural in casual conversation.',
        characterSet: 'simplified',
      }),
    )

    expect(html).toContain('Native alternative')
    expect(html).toContain('哈喽，很高兴认识你。')
    expect(html).toContain('口语')
    expect(html).toContain('More natural in casual conversation.')
  })

  it('converts the alternative to traditional characters', () => {
    const html = renderToStaticMarkup(
      createElement(NativeAlternativeCard, {
        alternative: '认识你很高兴。',
        register: 'formal',
        characterSet: 'traditional',
      }),
    )

    expect(html).toContain('認識你很高興。')
    expect(html).toContain('书面')
  })
})
