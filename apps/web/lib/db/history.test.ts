import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

import { query } from '@/lib/db'
import { upsertHistory } from './history'

describe('upsertHistory', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset()
    vi.mocked(query).mockResolvedValue([])
  })

  it('does not reassign rows on conflict (ownership WHERE clause)', async () => {
    await upsertHistory('user-a', [
      {
        id: '00000000-0000-4000-8000-000000000001',
        userId: null,
        sourceText: 'hi',
        sourceLang: 'en',
        targetLang: 'zh',
        translation: '你好',
        characterSet: 'simplified',
        dictionaryMatches: [],
        segments: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ])

    const insertSql = String(vi.mocked(query).mock.calls[0]?.[0])
    expect(insertSql).toContain('WHERE translations.user_id = EXCLUDED.user_id')
    expect(insertSql).not.toMatch(/DO UPDATE SET\s+user_id = EXCLUDED\.user_id/)
  })
})
