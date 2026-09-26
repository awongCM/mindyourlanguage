import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { ReviewEvent } from '@mindyourlanguage/shared'
import { GET, POST } from './route'

vi.mock('@/lib/auth-session', () => ({
  requireUserId: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: vi.fn(),
}))

vi.mock('@/lib/db/review-events', () => ({
  listReviewEvents: vi.fn(),
  appendReviewEvents: vi.fn(),
  DEFAULT_REVIEW_EVENTS_LIMIT: 500,
}))

import { requireUserId } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import { appendReviewEvents, listReviewEvents } from '@/lib/db/review-events'

const sampleEvent: ReviewEvent = {
  id: '22222222-2222-4222-8222-222222222222',
  phraseId: '11111111-1111-4111-8111-111111111111',
  grade: 'good',
  reviewedAt: '2026-01-01T00:00:00.000Z',
  mode: 'self_grade',
}

describe('/api/review-events', () => {
  beforeEach(() => {
    vi.mocked(requireUserId).mockReset()
    vi.mocked(isDatabaseConfigured).mockReset()
    vi.mocked(listReviewEvents).mockReset()
    vi.mocked(appendReviewEvents).mockReset()
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
  })

  it('GET returns 401 without session', async () => {
    vi.mocked(requireUserId).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    )

    const req = new NextRequest('http://localhost/api/review-events')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('GET returns events', async () => {
    vi.mocked(requireUserId).mockResolvedValue('user-1')
    vi.mocked(listReviewEvents).mockResolvedValue([sampleEvent])

    const req = new NextRequest('http://localhost/api/review-events')
    const res = await GET(req)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ events: [sampleEvent] })
  })

  it('POST appends events', async () => {
    vi.mocked(requireUserId).mockResolvedValue('user-1')
    vi.mocked(appendReviewEvents).mockResolvedValue([sampleEvent])

    const req = new Request('http://localhost/api/review-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [sampleEvent] }),
    })

    const res = await POST(req as never)
    expect(res.status).toBe(200)
    expect(appendReviewEvents).toHaveBeenCalledWith('user-1', [sampleEvent])
  })
})
