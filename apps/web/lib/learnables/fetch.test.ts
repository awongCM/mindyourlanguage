import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLearnables } from './fetch'

const originalOpenAiKey = process.env.OPENAI_API_KEY
const originalLearnablesModel = process.env.LEARNABLES_MODEL
const originalNativeAltModel = process.env.NATIVE_ALT_MODEL

describe('fetchLearnables', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key'
    delete process.env.LEARNABLES_MODEL
    delete process.env.NATIVE_ALT_MODEL
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey
    process.env.LEARNABLES_MODEL = originalLearnablesModel
    process.env.NATIVE_ALT_MODEL = originalNativeAltModel
    vi.unstubAllGlobals()
  })

  it('returns parsed learnables for a successful OpenAI response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [
                  {
                    chinese: '认识',
                    gloss: 'to get to know',
                    kind: 'verb',
                    exampleChinese: '很高兴认识你。',
                    exampleEnglish: 'Nice to meet you.',
                  },
                ],
              }),
            },
          },
        ],
      }),
    } as Response)

    const result = await fetchLearnables({
      sourceText: 'Nice to meet you.',
      translation: '认识你很高兴。',
      knownTranslations: ['你好'],
      voiceRegion: 'zh-CN',
    })

    expect(result).toEqual([
      {
        chinese: '认识',
        gloss: 'to get to know',
        kind: 'verb',
        exampleChinese: '很高兴认识你。',
        exampleEnglish: 'Nice to meet you.',
      },
    ])
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body.model).toBe('gpt-5.6-luna')
    expect(JSON.stringify(body.messages)).toContain('Mainland')
    expect(JSON.stringify(body.messages)).toContain('你好')
  })

  it('returns empty when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY
    const result = await fetchLearnables({
      sourceText: 'Hello',
      translation: '你好',
    })
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns empty when OpenAI fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response)

    const result = await fetchLearnables({
      sourceText: 'Hello',
      translation: '你好',
    })
    expect(result).toEqual([])
  })
})
