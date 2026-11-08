import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SyncPhraseForm } from './sync-phrase-form'

vi.mock('@/lib/sync/cloud-sync', () => ({
  pullAllStores: vi.fn(),
}))

describe('SyncPhraseForm', () => {
  it('offers save and open for a remembered phrase', () => {
    const html = renderToStaticMarkup(
      createElement(SyncPhraseForm, { hasPhrases: true }),
    )

    expect(html).toContain('Sync phrase')
    expect(html).toContain('Save phrase')
    expect(html).toContain('Open phrase')
    expect(html).toContain('browser that already shows your phrases')
  })
})
