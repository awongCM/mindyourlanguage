import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@mindyourlanguage/dictionary', () => ({
  lookupTerm: vi.fn().mockReturnValue([
    {
      simplified: '认识',
      traditional: '認識',
      pinyin: 'ren4 shi5',
      definitions: ['to know'],
    },
  ]),
}))

import { GET } from './route'
import { lookupTerm } from '@mindyourlanguage/dictionary'

describe('GET /api/dictionary', () => {
  beforeEach(() => {
    vi.mocked(lookupTerm).mockClear()
  })

  it('returns entries for q', async () => {
    const req = new Request('http://localhost/api/dictionary?q=认识&limit=5')
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.entries[0].simplified).toBe('认识')
    expect(lookupTerm).toHaveBeenCalledWith('认识', 5)
  })

  it('returns 400 when q missing', async () => {
    const req = new Request('http://localhost/api/dictionary')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
