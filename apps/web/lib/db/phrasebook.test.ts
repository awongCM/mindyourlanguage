import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

import { query } from '@/lib/db'
import { upsertPhrasebook } from './phrasebook'

describe('upsertPhrasebook', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset()
    vi.mocked(query).mockResolvedValue([])
  })

  it('does not reassign rows on conflict (ownership WHERE clause)', async () => {
    await upsertPhrasebook('user-a', [
      {
        id: '00000000-0000-4000-8000-000000000002',
        translationId: null,
        sourceText: 'hi',
        sourceLang: 'en',
        targetLang: 'zh',
        translation: '你好',
        characterSet: 'simplified',
        dictionaryMatches: [],
        segments: [],
        tags: [],
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ])

    const insertSql = String(vi.mocked(query).mock.calls[0]?.[0])
    expect(insertSql).toContain('WHERE phrasebook.user_id = EXCLUDED.user_id')
    expect(insertSql).not.toMatch(/DO UPDATE SET\s+user_id = EXCLUDED\.user_id/)
  })

  it('deletes phrasebook rows not present in the PUT payload', async () => {
    const id = '00000000-0000-4000-8000-000000000003'
    await upsertPhrasebook('user-a', [
      {
        id,
        translationId: null,
        sourceText: 'hi',
        sourceLang: 'en',
        targetLang: 'zh',
        translation: '你好',
        characterSet: 'simplified',
        dictionaryMatches: [],
        segments: [],
        tags: [],
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ])

    const deleteCall = vi.mocked(query).mock.calls.find((call) =>
      String(call[0]).includes('DELETE FROM phrasebook'),
    )
    expect(deleteCall?.[1]).toEqual(['user-a', [id]])
  })
})
