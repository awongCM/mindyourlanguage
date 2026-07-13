import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { POST } from './route'
import { checkRateLimit } from '@/lib/rate-limit'
import { translateText } from '@/lib/deepl'
import { fetchNativeAlternative } from '@/lib/native-alternative'
import {
  differsFromPrimary,
  shouldRequestNativeAlternative,
} from '@/lib/native-alternative-shared'

vi.mock('@/lib/deepl', () => ({
  translateText: vi.fn().mockResolvedValue({
    text: '你好',
    detectedLang: 'en',
  }),
}))

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return {
    ...actual,
    checkRateLimit: vi.fn().mockReturnValue(true),
  }
})

vi.mock('@/lib/enrich-translation', () => ({
  enrichChineseTranslation: vi.fn().mockReturnValue({
    pinyin: 'nǐ hǎo',
    traditional: '你好',
    segments: [{ text: '你', pinyin: 'nǐ' }, { text: '好', pinyin: 'hǎo' }],
    dictionaryMatches: [
      {
        simplified: '你好',
        traditional: '你好',
        pinyin: 'ni3 hao3',
        definitions: ['hello'],
      },
    ],
  }),
}))

vi.mock('@/lib/native-alternative', () => ({
  fetchNativeAlternative: vi.fn().mockResolvedValue({
    nativeAlternative: '嗨',
    register: 'casual',
  }),
}))

vi.mock('@/lib/native-alternative-shared', () => ({
  differsFromPrimary: vi.fn().mockReturnValue(true),
  shouldRequestNativeAlternative: vi.fn().mockReturnValue(false),
}))

function translateRequest(
  body: object,
  headers?: Record<string, string>,
): NextRequest {
  return new Request('http://localhost/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as NextRequest
}

describe('POST /api/translate', () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockClear()
    vi.mocked(checkRateLimit).mockReturnValue(true)
    vi.mocked(translateText).mockClear()
    vi.mocked(translateText).mockResolvedValue({
      text: '你好',
      detectedLang: 'en',
    })
    vi.mocked(fetchNativeAlternative).mockReset()
    vi.mocked(fetchNativeAlternative).mockResolvedValue({
      nativeAlternative: '嗨',
      register: 'casual',
    })
    vi.mocked(differsFromPrimary).mockReset()
    vi.mocked(differsFromPrimary).mockReturnValue(true)
    vi.mocked(shouldRequestNativeAlternative).mockReset()
    vi.mocked(shouldRequestNativeAlternative).mockReturnValue(false)
  })

  it('returns translation for valid English input', async () => {
    const req = translateRequest({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'zh',
      characterSet: 'simplified',
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.translation).toBe('你好')
    expect(body.pinyin).toBe('nǐ hǎo')
    expect(body.traditional).toBe('你好')
    expect(body.segments).toHaveLength(2)
    expect(body.dictionaryMatches).toHaveLength(1)
  })

  it('includes native alternative fields for opted-in English to Chinese input', async () => {
    vi.mocked(shouldRequestNativeAlternative).mockReturnValue(true)
    vi.mocked(fetchNativeAlternative).mockResolvedValue({
      nativeAlternative: '哈喽',
      register: 'casual',
      note: 'More natural in casual speech.',
    })

    const req = translateRequest({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'zh',
      characterSet: 'simplified',
      includeNativeAlternative: true,
      voiceRegion: 'zh-TW',
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.nativeAlternative).toBe('哈喽')
    expect(body.register).toBe('casual')
    expect(body.nativeNote).toBe('More natural in casual speech.')
    expect(shouldRequestNativeAlternative).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLang: 'en',
        targetLang: 'zh',
        includeNativeAlternative: true,
      }),
      '你好',
    )
    expect(fetchNativeAlternative).toHaveBeenCalledWith({
      sourceText: 'Hello',
      primaryTranslation: '你好',
      voiceRegion: 'zh-TW',
    })
  })

  it('omits native alternative fields when native fetch returns null', async () => {
    vi.mocked(shouldRequestNativeAlternative).mockReturnValue(true)
    vi.mocked(fetchNativeAlternative).mockResolvedValue(null)

    const req = translateRequest({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'zh',
      characterSet: 'simplified',
      includeNativeAlternative: true,
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.nativeAlternative).toBeUndefined()
    expect(body.register).toBeUndefined()
    expect(body.nativeNote).toBeUndefined()
  })

  it('does not fetch native alternative for Chinese to English input', async () => {
    const req = translateRequest({
      text: '你好',
      sourceLang: 'zh',
      targetLang: 'en',
      characterSet: 'simplified',
      includeNativeAlternative: true,
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(shouldRequestNativeAlternative).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLang: 'zh',
        targetLang: 'en',
        includeNativeAlternative: true,
      }),
      '你好',
    )
    expect(fetchNativeAlternative).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON body', async () => {
    const req = new Request('http://localhost/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }) as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty text', async () => {
    const req = translateRequest({
      text: '',
      sourceLang: 'en',
      targetLang: 'zh',
      characterSet: 'simplified',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when text exceeds 500 characters', async () => {
    const req = translateRequest({
      text: 'a'.repeat(501),
      sourceLang: 'en',
      targetLang: 'zh',
      characterSet: 'simplified',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(checkRateLimit).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid language', async () => {
    const req = translateRequest({
      text: 'Hello',
      sourceLang: 'fr',
      targetLang: 'zh',
      characterSet: 'simplified',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(checkRateLimit).not.toHaveBeenCalled()
  })

  it('rate limits by first x-forwarded-for hop', async () => {
    const req = translateRequest(
      {
        text: 'Hello',
        sourceLang: 'en',
        targetLang: 'zh',
        characterSet: 'simplified',
      },
      { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    )
    await POST(req)
    expect(checkRateLimit).toHaveBeenCalledWith('1.2.3.4')
  })

  it('returns 429 when rate limit exceeded', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(false)
    const req = translateRequest({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'zh',
      characterSet: 'simplified',
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
  })

  it('returns 502 when upstream translation fails', async () => {
    vi.mocked(translateText).mockRejectedValue(new Error('DeepL error'))
    const req = translateRequest({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'zh',
      characterSet: 'simplified',
    })
    const res = await POST(req)
    expect(res.status).toBe(502)
  })
})
