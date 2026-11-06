import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultOpenAiModel,
  fetchOpenAiJsonContent,
  voiceRegionLabel,
} from './openai-json'

const originalKey = process.env.OPENAI_API_KEY

describe('openai-json helpers', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey
    vi.unstubAllGlobals()
  })

  it('maps voice regions for prompts', () => {
    expect(voiceRegionLabel('zh-TW')).toBe('Taiwan Mandarin')
    expect(voiceRegionLabel('zh-CN')).toBe('Mainland Mandarin')
    expect(voiceRegionLabel(undefined)).toBe('Mainland Mandarin')
  })

  it('picks the first configured model env, else default', () => {
    expect(defaultOpenAiModel(undefined, undefined)).toBe('gpt-5.6-luna')
    expect(defaultOpenAiModel('custom', 'other')).toBe('custom')
  })

  it('returns content from a successful OpenAI JSON reply', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    } as Response)

    await expect(
      fetchOpenAiJsonContent({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-test',
      }),
    ).resolves.toBe('{"ok":true}')
  })

  it('returns null when the API key is missing', async () => {
    delete process.env.OPENAI_API_KEY
    await expect(
      fetchOpenAiJsonContent({
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
