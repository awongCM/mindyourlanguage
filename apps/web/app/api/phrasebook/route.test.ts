import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import type { PhrasebookEntry } from '@mindyourlanguage/shared'
import { GET, PUT } from './route'

vi.mock('@/lib/auth-session', () => ({
  requireUserId: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: vi.fn(),
}))

vi.mock('@/lib/db/phrasebook', () => ({
  listPhrasebook: vi.fn(),
  upsertPhrasebook: vi.fn(),
}))

import { requireUserId } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import { listPhrasebook, upsertPhrasebook } from '@/lib/db/phrasebook'

const sampleEntry: PhrasebookEntry = {
  id: '11111111-1111-4111-8111-111111111111',
  translationId: null,
  sourceText: 'Hello',
  sourceLang: 'en',
  targetLang: 'zh',
  translation: '你好',
  characterSet: 'simplified',
  dictionaryMatches: [],
  segments: [],
  tags: [],
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('/api/phrasebook', () => {
  beforeEach(() => {
    vi.mocked(requireUserId).mockReset()
    vi.mocked(isDatabaseConfigured).mockReset()
    vi.mocked(listPhrasebook).mockReset()
    vi.mocked(upsertPhrasebook).mockReset()
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
  })

  it('GET returns 401 without session', async () => {
    vi.mocked(requireUserId).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    )

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('GET returns phrasebook items', async () => {
    vi.mocked(requireUserId).mockResolvedValue('user-1')
    vi.mocked(listPhrasebook).mockResolvedValue([sampleEntry])

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [sampleEntry] })
  })

  it('PUT upserts and returns items', async () => {
    vi.mocked(requireUserId).mockResolvedValue('user-1')
    vi.mocked(upsertPhrasebook).mockResolvedValue([sampleEntry])

    const req = new Request('http://localhost/api/phrasebook', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [sampleEntry] }),
    })

    const res = await PUT(req as never)
    expect(res.status).toBe(200)
    expect(upsertPhrasebook).toHaveBeenCalledWith('user-1', [sampleEntry])
  })
})
