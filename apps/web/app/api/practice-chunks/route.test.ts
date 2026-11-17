import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { POST } from './route'
import { checkRateLimitForKey } from '@/lib/rate-limit'
import { fetchPracticeChunks } from '@/lib/practice-chunks'

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

vi.mock('@/lib/practice-chunks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/practice-chunks')>()
  return {
    ...actual,
    fetchPracticeChunks: vi.fn().mockResolvedValue([
      {
        english: 'First clause',
        chinese: '第一个分句',
      },
    ]),
  }
})

function practiceChunksRequest(
  body: object,
  headers?: Record<string, string>,
): NextRequest {
  return new Request('http://localhost/api/practice-chunks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as NextRequest
}

describe('POST /api/practice-chunks', () => {
  beforeEach(() => {
    vi.mocked(checkRateLimitForKey).mockClear()
    vi.mocked(checkRateLimitForKey).mockReturnValue(true)
    vi.mocked(fetchPracticeChunks).mockClear()
    vi.mocked(fetchPracticeChunks).mockResolvedValue([
      { english: 'First clause', chinese: '第一个分句' },
    ])
  })

  it('returns chunk items', async () => {
    const res = await POST(
      practiceChunksRequest({
        sourceText: 'Long English paragraph.',
        translation: '这是一段比较长的中文内容用来练习记忆的句子。',
        characterSet: 'simplified',
        voiceRegion: 'zh-CN',
      }),
    )
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      items: [{ english: 'First clause', chinese: '第一个分句' }],
    })
    expect(fetchPracticeChunks).toHaveBeenCalledWith({
      sourceText: 'Long English paragraph.',
      translation: '这是一段比较长的中文内容用来练习记忆的句子。',
      voiceRegion: 'zh-CN',
      characterSet: 'simplified',
    })
  })

  it('returns empty items when the fetch yields none', async () => {
    vi.mocked(fetchPracticeChunks).mockResolvedValue([])
    const res = await POST(
      practiceChunksRequest({
        sourceText: 'Long English.',
        translation: '这是一段比较长的中文内容用来练习记忆的句子。',
        characterSet: 'simplified',
      }),
    )
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
  })

  it('returns 400 for a bad body', async () => {
    const res = await POST(
      practiceChunksRequest({
        sourceText: '',
        translation: '',
        characterSet: 'simplified',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimitForKey).mockReturnValue(false)
    const res = await POST(
      practiceChunksRequest({
        sourceText: 'Hello',
        translation: '你好',
        characterSet: 'simplified',
      }),
    )
    expect(res.status).toBe(429)
  })
})