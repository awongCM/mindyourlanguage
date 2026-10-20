import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewEvent } from '@mindyourlanguage/shared'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

import { query } from '@/lib/db'
import { REVIEW_EVENTS_SERVER_MAX } from '@/lib/sync/limits'
import { appendReviewEvents } from './review-events'

const event: ReviewEvent = {
  id: '22222222-2222-4222-8222-222222222222',
  phraseId: '11111111-1111-4111-8111-111111111111',
  grade: 'good',
  reviewedAt: '2026-01-01T00:00:00.000Z',
  mode: 'self_grade',
}

describe('appendReviewEvents', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset()
    vi.mocked(query).mockResolvedValue([])
  })

  function sqlOf(call: unknown[] | undefined) {
    return String(call?.[0])
  }

  it('trims the oldest events per user after inserting', async () => {
    await appendReviewEvents('user-a', [event])

    const calls = vi.mocked(query).mock.calls
    const insertIndex = calls.findIndex((c) =>
      sqlOf(c).includes('INSERT INTO review_events'),
    )
    const trimIndex = calls.findIndex((c) =>
      sqlOf(c).includes('DELETE FROM review_events'),
    )
    expect(insertIndex).toBeGreaterThanOrEqual(0)
    expect(trimIndex).toBeGreaterThan(insertIndex)

    const trim = calls[trimIndex]
    expect(sqlOf(trim)).toMatch(/user_id = \$1/)
    expect(sqlOf(trim)).toMatch(/ORDER BY reviewed_at DESC\s+LIMIT \$2/)
    expect(trim?.[1]).toEqual(['user-a', REVIEW_EVENTS_SERVER_MAX])
  })

  it('does not issue a trim when there are no events to append', async () => {
    await appendReviewEvents('user-a', [])

    const trims = vi
      .mocked(query)
      .mock.calls.filter((c) => sqlOf(c).includes('DELETE FROM review_events'))
    expect(trims).toHaveLength(0)
  })
})
