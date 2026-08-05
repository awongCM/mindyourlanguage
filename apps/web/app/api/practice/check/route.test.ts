import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { GET, POST } from './route'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  checkUserAttempt,
  isCheckAttemptAvailable,
} from '@/lib/practice/check-attempt'

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return {
    ...actual,
    checkRateLimit: vi.fn().mockReturnValue(true),
  }
})

vi.mock('@/lib/practice/check-attempt', () => ({
  isCheckAttemptAvailable: vi.fn().mockReturnValue(true),
  checkUserAttempt: vi.fn().mockResolvedValue({
    verdict: 'close',
    feedback: 'Natural phrasing.',
  }),
}))

function checkRequest(body: object): NextRequest {
  return new Request('http://localhost/api/practice/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as NextRequest
}

describe('GET /api/practice/check', () => {
  it('reports availability', async () => {
    vi.mocked(isCheckAttemptAvailable).mockReturnValue(true)
    const response = await GET()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ available: true })
  })
})

describe('POST /api/practice/check', () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockReturnValue(true)
    vi.mocked(isCheckAttemptAvailable).mockReturnValue(true)
    vi.mocked(checkUserAttempt).mockResolvedValue({
      verdict: 'close',
      feedback: 'Natural phrasing.',
    })
  })

  it('returns 503 when unavailable', async () => {
    vi.mocked(isCheckAttemptAvailable).mockReturnValue(false)
    const response = await POST(
      checkRequest({
        userAttempt: '你好',
        primaryTranslation: '你好',
        sourceText: 'Hello',
      }),
    )
    expect(response.status).toBe(503)
  })

  it('validates required fields', async () => {
    const response = await POST(
      checkRequest({ userAttempt: '', primaryTranslation: '你好' }),
    )
    expect(response.status).toBe(400)
  })

  it('returns check feedback', async () => {
    const response = await POST(
      checkRequest({
        sourceText: 'Hello',
        userAttempt: '你好',
        primaryTranslation: '你好',
      }),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      verdict: 'close',
      feedback: 'Natural phrasing.',
    })
  })
})
