/**
 * Shared OpenAI chat-completions helper for JSON responses.
 * Used by native alternative, learnables, and practice check.
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MODEL = 'gpt-5.6-luna'

export type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function defaultOpenAiModel(
  ...envKeys: Array<string | undefined>
): string {
  for (const key of envKeys) {
    if (key) return key
  }
  return DEFAULT_MODEL
}

export function voiceRegionLabel(
  voiceRegion: 'zh-CN' | 'zh-TW' | undefined,
): string {
  return voiceRegion === 'zh-TW' ? 'Taiwan Mandarin' : 'Mainland Mandarin'
}

/**
 * Calls OpenAI with response_format=json_object.
 * Returns message content, or null when unavailable / failed.
 */
export async function fetchOpenAiJsonContent(options: {
  messages: OpenAiChatMessage[]
  model?: string
  timeoutMs?: number
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model ?? DEFAULT_MODEL,
        response_format: { type: 'json_object' },
        messages: options.messages,
      }),
    })

    if (!res.ok) return null

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
    const content = data.choices?.[0]?.message?.content
    return typeof content === 'string' ? content : null
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}
