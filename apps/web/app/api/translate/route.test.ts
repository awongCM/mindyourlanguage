import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { checkRateLimit } from '@/lib/rate-limit'

vi.mock('@/lib/deepl', () => ({
  translateText: vi.fn().mockResolvedValue({
    text: '你好',
    detectedLang: 'en',
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/enrich-translation', () => ({
  enrichChineseTranslation: vi.fn().mockReturnValue({
    pinyin: 'nǐ hǎo',
    traditional: '你好',
    segments: [{ text: '你', pinyin: 'nǐ' }, { text: '好', pinyin: 'hǎo' }],
  }),
}))

describe('POST /api/translate', () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockReturnValue(true)
  })

  it('returns translation for valid English input', async () => {
    const req = new Request('http://localhost/api/translate', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Hello',
        sourceLang: 'en',
        targetLang: 'zh',
        characterSet: 'simplified',
      }),
    })
    const res = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.translation).toBe('你好')
    expect(body.pinyin).toBe('nǐ hǎo')
    expect(body.traditional).toBe('你好')
    expect(body.segments).toHaveLength(2)
  })

  it('returns 400 for empty text', async () => {
    const req = new Request('http://localhost/api/translate', {
      method: 'POST',
      body: JSON.stringify({
        text: '',
        sourceLang: 'en',
        targetLang: 'zh',
        characterSet: 'simplified',
      }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limit exceeded', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(false)
    const req = new Request('http://localhost/api/translate', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Hello',
        sourceLang: 'en',
        targetLang: 'zh',
        characterSet: 'simplified',
      }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(429)
  })
})
