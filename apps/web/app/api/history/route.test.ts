import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TranslationRecord } from '@mindyourlanguage/shared'
import { GET, PUT } from './route'
import { HISTORY_MAX } from '@/lib/stores/history'

vi.mock('@/lib/auth-session', () => ({
  resolveSyncUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: vi.fn(),
}))

vi.mock('@/lib/db/history', () => ({
  listHistory: vi.fn(),
  upsertHistory: vi.fn(),
}))

import { resolveSyncUser } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import { listHistory, upsertHistory } from '@/lib/db/history'

function sampleRecord(index: number): TranslationRecord {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    userId: null,
    sourceText: `text-${index}`,
    sourceLang: 'en',
    targetLang: 'zh',
    translation: `你好-${index}`,
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
    createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  }
}

function putBody(body: unknown) {
  return new Request('http://localhost/api/history', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function putRequest(items: TranslationRecord[], deletedIds?: string[]) {
  return putBody(deletedIds === undefined ? { items } : { items, deletedIds })
}

const goneId = '22222222-2222-4222-8222-222222222222'

describe('/api/history', () => {
  beforeEach(() => {
    vi.mocked(resolveSyncUser).mockReset()
    vi.mocked(isDatabaseConfigured).mockReset()
    vi.mocked(listHistory).mockReset()
    vi.mocked(upsertHistory).mockReset()
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
  })

  it('GET returns 501 when the database is not configured', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false)

    const res = await GET()
    expect(res.status).toBe(501)
    expect(resolveSyncUser).not.toHaveBeenCalled()
  })

  it('GET returns an empty list when the browser has no identity yet', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(listHistory).not.toHaveBeenCalled()
  })

  it('GET returns items for the resolved user', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    const items = [sampleRecord(1)]
    vi.mocked(listHistory).mockResolvedValue(items)

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items })
    expect(listHistory).toHaveBeenCalledWith('user-1')
  })

  it('GET returns 503 when database query fails', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(listHistory).mockRejectedValue(new Error('db down'))

    const res = await GET()
    expect(res.status).toBe(503)
  })

  it('PUT caps items at HISTORY_MAX', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    const many = Array.from({ length: HISTORY_MAX + 5 }, (_, i) =>
      sampleRecord(i),
    )
    vi.mocked(upsertHistory).mockImplementation(async (_userId, items) =>
      items.slice(0, HISTORY_MAX),
    )

    const res = await PUT(putRequest(many) as never)
    expect(res.status).toBe(200)
    expect(vi.mocked(upsertHistory).mock.calls[0]?.[1]).toHaveLength(
      HISTORY_MAX + 5,
    )
    const json = await res.json()
    expect(json.items).toHaveLength(HISTORY_MAX)
  })

  it('PUT with items may create the anonymous user', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(upsertHistory).mockResolvedValue([sampleRecord(1)])

    await PUT(putRequest([sampleRecord(1)]) as never)
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: true })
  })

  it('PUT with no items never creates a user and returns an empty list', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await PUT(putRequest([]) as never)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(upsertHistory).not.toHaveBeenCalled()
  })

  it('PUT returns 429 when anonymous user creation is rate limited', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'rate_limited' })

    const res = await PUT(putRequest([sampleRecord(1)]) as never)
    expect(res.status).toBe(429)
    expect(upsertHistory).not.toHaveBeenCalled()
  })

  it('PUT returns 400 for an invalid body', async () => {
    const req = new Request('http://localhost/api/history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: 'nope' }),
    })

    const res = await PUT(req as never)
    expect(res.status).toBe(400)
    expect(resolveSyncUser).not.toHaveBeenCalled()
  })

  it('PUT passes explicit deletedIds through to the db layer', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(upsertHistory).mockResolvedValue([])

    const res = await PUT(putRequest([sampleRecord(1)], [goneId]) as never)
    expect(res.status).toBe(200)
    expect(upsertHistory).toHaveBeenCalledWith(
      'user-1',
      [sampleRecord(1)],
      [goneId],
    )
  })

  it('PUT sends an empty deletedIds list when none are given', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(upsertHistory).mockResolvedValue([])

    await PUT(putRequest([sampleRecord(1)]) as never)
    expect(upsertHistory).toHaveBeenCalledWith('user-1', [sampleRecord(1)], [])
  })

  it('PUT drops non-UUID ids, ids also present in items, and duplicates', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(upsertHistory).mockResolvedValue([])

    await PUT(
      putRequest(
        [sampleRecord(1)],
        [
          goneId,
          goneId,
          sampleRecord(1).id,
          'not-a-uuid',
          "'; DROP TABLE translations; --",
        ],
      ) as never,
    )
    expect(upsertHistory).toHaveBeenCalledWith(
      'user-1',
      [sampleRecord(1)],
      [goneId],
    )
  })

  it('PUT returns 400 when deletedIds is not an array of strings', async () => {
    for (const deletedIds of ['nope', { a: 1 }, [1, 2], [goneId, null]]) {
      const res = await PUT(putBody({ items: [], deletedIds }) as never)
      expect(res.status).toBe(400)
    }
    expect(resolveSyncUser).not.toHaveBeenCalled()
    expect(upsertHistory).not.toHaveBeenCalled()
  })

  it('PUT with only deletedIds and a valid cookie deletes without creating a user', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(upsertHistory).mockResolvedValue([])

    const res = await PUT(putRequest([], [goneId]) as never)
    expect(res.status).toBe(200)
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(upsertHistory).toHaveBeenCalledWith('user-1', [], [goneId])
  })

  it('PUT with only deletedIds and no identity returns an empty list without a db call', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await PUT(putRequest([], [goneId]) as never)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
    expect(upsertHistory).not.toHaveBeenCalled()
  })
})
