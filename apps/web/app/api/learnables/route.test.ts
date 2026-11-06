import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { POST } from './route'
import { checkRateLimitForKey } from '@/lib/rate-limit'
import { fetchLearnables } from '@/lib/learnables'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return {
    ...actual,
    checkRateLimitForKey: vi.fn().mockReturnValue(true),
  }
})

vi.mock('@/lib/learnables', () => ({
  fetchLearnables: vi.fn().mockResolvedValue([
    {
      chinese: '认识',
      gloss: 'to get to know',
      kind: 'verb',
      exampleChinese: '很高兴认识你。',
      exampleEnglish: 'Nice to meet you.',
    },
  ]),
}))

function learnablesRequest(
  body: object,
  headers?: Record<string, string>,
): NextRequest {
  return new Request('http://localhost/api/learnables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as NextRequest
}

describe('POST /api/learnables', () => {
  beforeEach(() => {
    vi.mocked(checkRateLimitForKey).mockClear()
    vi.mocked(checkRateLimitForKey).mockReturnValue(true)
    vi.mocked(fetchLearnables).mockClear()
    vi.mocked(fetchLearnables).mockResolvedValue([
      {
        chinese: '认识',
        gloss: 'to get to know',
        kind: 'verb',
        exampleChinese: '很高兴认识你。',
        exampleEnglish: 'Nice to meet you.',
      },
    ])
  })

  it('returns learnable items', async () => {
    const res = await POST(
      learnablesRequest({
        sourceText: 'Nice to meet you.',
        translation: '认识你很高兴。',
        knownTranslations: ['你好'],
        voiceRegion: 'zh-CN',
      }),
    )
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      items: [
        {
          chinese: '认识',
          gloss: 'to get to know',
          kind: 'verb',
          exampleChinese: '很高兴认识你。',
          exampleEnglish: 'Nice to meet you.',
        },
      ],
    })
    expect(fetchLearnables).toHaveBeenCalledWith({
      sourceText: 'Nice to meet you.',
      translation: '认识你很高兴。',
      knownTranslations: ['你好'],
      voiceRegion: 'zh-CN',
    })
  })

  it('returns empty items when the fetch yields none', async () => {
    vi.mocked(fetchLearnables).mockResolvedValue([])
    const res = await POST(
      learnablesRequest({
        sourceText: 'Hello',
        translation: '你好',
      }),
    )
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
  })

  it('returns 400 for a bad body', async () => {
    const res = await POST(
      learnablesRequest({
        sourceText: '',
        translation: '',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimitForKey).mockReturnValue(false)
    const res = await POST(
      learnablesRequest({
        sourceText: 'Hello',
        translation: '你好',
      }),
    )
    expect(res.status).toBe(429)
  })
})
