import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@mindyourlanguage/dictionary', () => ({
  getDictionaryDb: vi.fn(),
}))

import { GET } from './route'
import { getDictionaryDb } from '@mindyourlanguage/dictionary'

describe('GET /api/health', () => {
  const originalKey = process.env.DEEPL_API_KEY

  beforeEach(() => {
    vi.mocked(getDictionaryDb).mockReset()
    process.env.DEEPL_API_KEY = 'test-key'
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.DEEPL_API_KEY
    } else {
      process.env.DEEPL_API_KEY = originalKey
    }
  })

  it('returns 200 when CEDICT and DeepL are ready', async () => {
    vi.mocked(getDictionaryDb).mockReturnValue({} as never)
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      cedict: true,
      deeplConfigured: true,
    })
  })

  it('returns 503 when CEDICT missing', async () => {
    vi.mocked(getDictionaryDb).mockReturnValue(null)
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.cedict).toBe(false)
    expect(body.deeplConfigured).toBe(true)
  })

  it('returns 503 when DeepL key missing', async () => {
    vi.mocked(getDictionaryDb).mockReturnValue({} as never)
    delete process.env.DEEPL_API_KEY
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.deeplConfigured).toBe(false)
  })
})
