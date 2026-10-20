import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

import { query } from '@/lib/db'
import { upsertPhrasebook } from './phrasebook'
import { PayloadTooLargeError, PHRASEBOOK_MAX_ITEMS } from '@/lib/sync/limits'

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

    const insertSql = String(
      vi
        .mocked(query)
        .mock.calls.find((call) => String(call[0]).includes('INSERT INTO phrasebook'))?.[0],
    )
    expect(insertSql).toContain('WHERE phrasebook.user_id = EXCLUDED.user_id')
    expect(insertSql).not.toMatch(/DO UPDATE SET\s+user_id = EXCLUDED\.user_id/)
  })

  function deleteCalls() {
    return vi
      .mocked(query)
      .mock.calls.filter((call) =>
        String(call[0]).includes('DELETE FROM phrasebook'),
      )
  }

  it('does not delete rows that are merely absent from the payload', async () => {
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

    expect(deleteCalls()).toHaveLength(0)
  })

  it('does not delete cloud rows when the payload is empty and no ids are named', async () => {
    await upsertPhrasebook('user-a', [])

    expect(deleteCalls()).toHaveLength(0)
  })

  it('deletes exactly the named ids, scoped by user', async () => {
    const ids = [
      '00000000-0000-4000-8000-000000000004',
      '00000000-0000-4000-8000-000000000005',
    ]
    await upsertPhrasebook('user-a', [], ids)

    const calls = deleteCalls()
    expect(calls).toHaveLength(1)
    expect(String(calls[0]?.[0])).toMatch(/user_id = \$1/)
    expect(String(calls[0]?.[0])).toMatch(/id = ANY\(\$2::uuid\[\]\)/)
    expect(calls[0]?.[1]).toEqual(['user-a', ids])
  })

  describe('per-user cap', () => {
    const entry = (id: string) => ({
      id,
      translationId: null,
      sourceText: 'hi',
      sourceLang: 'en' as const,
      targetLang: 'zh' as const,
      translation: '你好',
      characterSet: 'simplified' as const,
      dictionaryMatches: [],
      segments: [],
      tags: [],
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const idA = '00000000-0000-4000-8000-00000000000a'
    const idB = '00000000-0000-4000-8000-00000000000b'
    const goneId = '00000000-0000-4000-8000-00000000000c'

    function countCalls() {
      return vi
        .mocked(query)
        .mock.calls.filter((call) => String(call[0]).includes('count(*)'))
    }

    function insertCalls() {
      return vi
        .mocked(query)
        .mock.calls.filter((call) =>
          String(call[0]).includes('INSERT INTO phrasebook'),
        )
    }

    it('counts rows outside this payload, scoped by user, before any upsert', async () => {
      vi.mocked(query).mockResolvedValueOnce([{ n: 0 }])
      await upsertPhrasebook('user-a', [entry(idA), entry(idB)], [goneId])

      const calls = countCalls()
      expect(calls).toHaveLength(1)
      const sql = String(calls[0]?.[0])
      expect(sql).toMatch(/user_id = \$1/)
      expect(sql).toMatch(/id <> ALL\(\$2::uuid\[\]\)/)
      expect(sql).toMatch(/id <> ALL\(\$3::uuid\[\]\)/)
      expect(calls[0]?.[1]).toEqual(['user-a', [idA, idB], [goneId]])
      expect(vi.mocked(query).mock.calls[0]?.[0]).toBe(calls[0]?.[0])
    })

    it('allows a payload that lands exactly on the cap', async () => {
      vi.mocked(query).mockResolvedValueOnce([{ n: PHRASEBOOK_MAX_ITEMS - 1 }])
      await expect(
        upsertPhrasebook('user-a', [entry(idA)]),
      ).resolves.toBeDefined()
      expect(insertCalls()).toHaveLength(1)
    })

    it('throws PayloadTooLargeError and writes nothing when over the cap', async () => {
      vi.mocked(query).mockResolvedValueOnce([{ n: PHRASEBOOK_MAX_ITEMS }])
      await expect(
        upsertPhrasebook('user-a', [entry(idA)]),
      ).rejects.toBeInstanceOf(PayloadTooLargeError)
      expect(insertCalls()).toHaveLength(0)
      expect(deleteCalls()).toHaveLength(0)
    })

    it('skips the count query when there is nothing to upsert', async () => {
      await upsertPhrasebook('user-a', [], [goneId])
      expect(countCalls()).toHaveLength(0)
    })
  })
})
