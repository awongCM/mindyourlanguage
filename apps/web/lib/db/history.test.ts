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

  it('only trims the translations table (phrasebook is not coupled to history)', async () => {
    await upsertHistory('user-a', [])

    const deletes = vi
      .mocked(query)
      .mock.calls.map((call) => String(call[0]))
      .filter((sql) => /DELETE\s+FROM/i.test(sql))
    expect(deletes).toHaveLength(1)
    expect(deletes[0]).toMatch(/DELETE FROM translations/)
    expect(deletes[0]).not.toMatch(/phrasebook/i)
  })

  it('deletes the named ids (scoped by user) after upserts and before the trim', async () => {
    const ids = [
      '00000000-0000-4000-8000-000000000004',
      '00000000-0000-4000-8000-000000000005',
    ]
    await upsertHistory('user-a', [], ids)

    const deleteCalls = vi
      .mocked(query)
      .mock.calls.filter((call) => /DELETE\s+FROM/i.test(String(call[0])))
    expect(deleteCalls).toHaveLength(2)
    const [byIds, trim] = deleteCalls
    expect(String(byIds?.[0])).toMatch(/DELETE FROM translations/)
    expect(String(byIds?.[0])).toMatch(/user_id = \$1/)
    expect(String(byIds?.[0])).toMatch(/id = ANY\(\$2::uuid\[\]\)/)
    expect(byIds?.[1]).toEqual(['user-a', ids])
    expect(String(trim?.[0])).toMatch(/NOT IN/)
  })

  it('runs no delete-by-ids when no ids are named', async () => {
    await upsertHistory('user-a', [])

    const deletes = vi
      .mocked(query)
      .mock.calls.map((call) => String(call[0]))
      .filter((sql) => /id = ANY/i.test(sql))
    expect(deletes).toHaveLength(0)
  })
})
