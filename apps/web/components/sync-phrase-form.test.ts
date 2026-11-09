import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  followupAfterSyncAction,
  SyncPhraseForm,
} from './sync-phrase-form'

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
    expect(html).not.toMatch(/<button[^>]*\sdisabled[\s=>]/)
  })

  it('disables save when this browser has no phrases yet', () => {
    const html = renderToStaticMarkup(
      createElement(SyncPhraseForm, { hasPhrases: false }),
    )
    const saveButton = html.slice(html.indexOf('<button'), html.indexOf('Save phrase'))
    const openButton = html.slice(html.lastIndexOf('<button'), html.indexOf('Open phrase'))
    expect(saveButton).toMatch(/\sdisabled[\s=>]/)
    expect(openButton).not.toMatch(/\sdisabled[\s=>]/)
  })
})

describe('followupAfterSyncAction', () => {
  it('pulls only after a successful open or forget', () => {
    expect(followupAfterSyncAction('open', true)).toBe('pull')
    expect(followupAfterSyncAction('forget', true)).toBe('pull')
    expect(followupAfterSyncAction('open', false)).toBe('none')
    expect(followupAfterSyncAction('save', true)).toBe('none')
  })
})
