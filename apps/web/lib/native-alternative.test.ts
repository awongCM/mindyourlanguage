import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchNativeAlternative } from './native-alternative'

const originalOpenAiKey = process.env.OPENAI_API_KEY
const originalNativeAltModel = process.env.NATIVE_ALT_MODEL

describe('fetchNativeAlternative', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key'
    delete process.env.NATIVE_ALT_MODEL
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey
    process.env.NATIVE_ALT_MODEL = originalNativeAltModel
    vi.unstubAllGlobals()
  })

  it('returns the parsed native alternative for a successful OpenAI response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                nativeAlternative: '很高兴认识你。',
                register: 'casual',
                note: 'A natural spoken version.',
              }),
            },
          },
        ],
      }),
    } as Response)

    const result = await fetchNativeAlternative({
      sourceText: 'Nice to meet you.',
      primaryTranslation: '认识你很高兴。',
      voiceRegion: 'zh-CN',
    })

    expect(result).toEqual({
      nativeAlternative: '很高兴认识你。',
      register: 'casual',
      note: 'A natural spoken version.',
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-openai-key',
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
      }),
    )
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(JSON.stringify(body.messages)).toContain('Mainland')
    expect(JSON.stringify(body.messages)).toContain('Nice to meet you.')
    expect(JSON.stringify(body.messages)).toContain('认识你很高兴。')
  })

  it('returns null when the OpenAI API fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response)

    const result = await fetchNativeAlternative({
      sourceText: 'Nice to meet you.',
      primaryTranslation: '认识你很高兴。',
      voiceRegion: 'zh-TW',
    })

    expect(result).toBeNull()
  })

  it('returns null without calling OpenAI when the API key is missing', async () => {
    delete process.env.OPENAI_API_KEY

    const result = await fetchNativeAlternative({
      sourceText: 'Nice to meet you.',
      primaryTranslation: '认识你很高兴。',
      voiceRegion: 'zh-CN',
    })

    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null when OpenAI returns invalid JSON content', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'not json',
            },
          },
        ],
      }),
    } as Response)

    const result = await fetchNativeAlternative({
      sourceText: 'Nice to meet you.',
      primaryTranslation: '认识你很高兴。',
      voiceRegion: 'zh-CN',
    })

    expect(result).toBeNull()
  })
})
