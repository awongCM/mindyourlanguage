import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import type { TranslationRecord } from '@mindyourlanguage/shared'
import { GET, PUT } from './route'
import { HISTORY_MAX } from '@/lib/stores/history'

vi.mock('@/lib/auth-session', () => ({
  requireUserId: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: vi.fn(),
}))

vi.mock('@/lib/db/history', () => ({
  listHistory: vi.fn(),
  upsertHistory: vi.fn(),
}))

import { requireUserId } from '@/lib/auth-session'
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

describe('/api/history', () => {
  beforeEach(() => {
    vi.mocked(requireUserId).mockReset()
    vi.mocked(isDatabaseConfigured).mockReset()
    vi.mocked(listHistory).mockReset()
    vi.mocked(upsertHistory).mockReset()
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
  })

  it('GET returns 401 without session', async () => {
    vi.mocked(requireUserId).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    )

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('GET returns items for authenticated user', async () => {
    vi.mocked(requireUserId).mockResolvedValue('user-1')
    const items = [sampleRecord(1)]
    vi.mocked(listHistory).mockResolvedValue(items)

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items })
  })

  it('GET returns 503 when database query fails', async () => {
    vi.mocked(requireUserId).mockResolvedValue('user-1')
    vi.mocked(listHistory).mockRejectedValue(new Error('db down'))

    const res = await GET()
    expect(res.status).toBe(503)
  })

  it('PUT caps items at HISTORY_MAX', async () => {
    vi.mocked(requireUserId).mockResolvedValue('user-1')
    const many = Array.from({ length: HISTORY_MAX + 5 }, (_, i) =>
      sampleRecord(i),
    )
    vi.mocked(upsertHistory).mockImplementation(async (_userId, items) =>
      items.slice(0, HISTORY_MAX),
    )

    const req = new Request('http://localhost/api/history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: many }),
    })

    const res = await PUT(req as never)
    expect(res.status).toBe(200)
    expect(vi.mocked(upsertHistory).mock.calls[0]?.[1]).toHaveLength(
      HISTORY_MAX + 5,
    )
    const json = await res.json()
    expect(json.items).toHaveLength(HISTORY_MAX)
  })
})
