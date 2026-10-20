import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { ReviewEvent } from '@mindyourlanguage/shared'
import { GET, POST } from './route'
import {
  REVIEW_EVENTS_SYNC_MAX,
  SYNC_MAX_BODY_BYTES,
} from '@/lib/sync/limits'

vi.mock('@/lib/auth-session', () => ({
  resolveSyncUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: vi.fn(),
}))

vi.mock('@/lib/db/review-events', () => ({
  listReviewEvents: vi.fn(),
  appendReviewEvents: vi.fn(),
  DEFAULT_REVIEW_EVENTS_LIMIT: 500,
}))

import { resolveSyncUser } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import { appendReviewEvents, listReviewEvents } from '@/lib/db/review-events'

const sampleEvent: ReviewEvent = {
  id: '22222222-2222-4222-8222-222222222222',
  phraseId: '11111111-1111-4111-8111-111111111111',
  grade: 'good',
  reviewedAt: '2026-01-01T00:00:00.000Z',
  mode: 'self_grade',
}

function postRequest(events: ReviewEvent[]) {
  return new Request('http://localhost/api/review-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  })
}

describe('/api/review-events', () => {
  beforeEach(() => {
    vi.mocked(resolveSyncUser).mockReset()
    vi.mocked(isDatabaseConfigured).mockReset()
    vi.mocked(listReviewEvents).mockReset()
    vi.mocked(appendReviewEvents).mockReset()
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
  })

  it('GET returns 501 when the database is not configured', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false)

    const res = await GET(new NextRequest('http://localhost/api/review-events'))
    expect(res.status).toBe(501)
  })

  it('GET returns an empty list when the browser has no identity yet', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await GET(new NextRequest('http://localhost/api/review-events'))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ events: [] })
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(listReviewEvents).not.toHaveBeenCalled()
  })

  it('GET returns events', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(listReviewEvents).mockResolvedValue([sampleEvent])

    const res = await GET(new NextRequest('http://localhost/api/review-events'))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ events: [sampleEvent] })
  })

  it('POST appends events', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(appendReviewEvents).mockResolvedValue([sampleEvent])

    const res = await POST(postRequest([sampleEvent]) as never)
    expect(res.status).toBe(200)
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: true })
    expect(appendReviewEvents).toHaveBeenCalledWith('user-1', [sampleEvent])
  })

  it('POST with no events never creates a user and returns an empty list', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await POST(postRequest([]) as never)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ events: [] })
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(appendReviewEvents).not.toHaveBeenCalled()
  })

  it('POST returns 429 when anonymous user creation is rate limited', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'rate_limited' })

    const res = await POST(postRequest([sampleEvent]) as never)
    expect(res.status).toBe(429)
    expect(appendReviewEvents).not.toHaveBeenCalled()
  })

  it('POST returns 413 when content-length is over the body limit', async () => {
    const req = new Request('http://localhost/api/review-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'content-length': String(SYNC_MAX_BODY_BYTES + 1),
      },
      body: JSON.stringify({ events: [] }),
    })

    const res = await POST(req as never)
    expect(res.status).toBe(413)
    await expect(res.json()).resolves.toEqual({ error: 'Payload too large' })
    expect(resolveSyncUser).not.toHaveBeenCalled()
  })

  it('POST returns 413 when events exceed REVIEW_EVENTS_SYNC_MAX', async () => {
    const many = Array.from(
      { length: REVIEW_EVENTS_SYNC_MAX + 1 },
      () => sampleEvent,
    )

    const res = await POST(postRequest(many) as never)
    expect(res.status).toBe(413)
    await expect(res.json()).resolves.toEqual({ error: 'Payload too large' })
    expect(resolveSyncUser).not.toHaveBeenCalled()
    expect(appendReviewEvents).not.toHaveBeenCalled()
  })

  it('POST returns 400 when events is not an array', async () => {
    const req = new Request('http://localhost/api/review-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: 'nope' }),
    })

    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })
})
