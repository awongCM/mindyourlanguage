import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PhrasebookEntry } from '@mindyourlanguage/shared'
import { GET, PUT } from './route'

vi.mock('@/lib/auth-session', () => ({
  resolveSyncUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: vi.fn(),
}))

vi.mock('@/lib/db/phrasebook', () => ({
  listPhrasebook: vi.fn(),
  upsertPhrasebook: vi.fn(),
}))

import { resolveSyncUser } from '@/lib/auth-session'
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

function putRequest(items: PhrasebookEntry[]) {
  return new Request('http://localhost/api/phrasebook', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
}

describe('/api/phrasebook', () => {
  beforeEach(() => {
    vi.mocked(resolveSyncUser).mockReset()
    vi.mocked(isDatabaseConfigured).mockReset()
    vi.mocked(listPhrasebook).mockReset()
    vi.mocked(upsertPhrasebook).mockReset()
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
  })

  it('GET returns 501 when the database is not configured', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false)

    const res = await GET()
    expect(res.status).toBe(501)
  })

  it('GET returns an empty list when the browser has no identity yet', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(listPhrasebook).not.toHaveBeenCalled()
  })

  it('GET returns phrasebook items', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(listPhrasebook).mockResolvedValue([sampleEntry])

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [sampleEntry] })
  })

  it('PUT upserts and returns items', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(upsertPhrasebook).mockResolvedValue([sampleEntry])

    const res = await PUT(putRequest([sampleEntry]) as never)
    expect(res.status).toBe(200)
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: true })
    expect(upsertPhrasebook).toHaveBeenCalledWith('user-1', [sampleEntry])
  })

  it('PUT with no items never creates a user and returns an empty list', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await PUT(putRequest([]) as never)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(upsertPhrasebook).not.toHaveBeenCalled()
  })

  it('PUT returns 429 when anonymous user creation is rate limited', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'rate_limited' })

    const res = await PUT(putRequest([sampleEntry]) as never)
    expect(res.status).toBe(429)
    expect(upsertPhrasebook).not.toHaveBeenCalled()
  })
})
