import type { VoiceRegion } from '@mindyourlanguage/shared'

import {
  differsFromPrimary,
  parseNativeAlternativeResponse,
  type NativeAlternativeResult,
} from './native-alternative-shared'

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_NATIVE_ALT_MODEL = 'gpt-4o-mini'

interface FetchNativeAlternativeParams {
  sourceText: string
  primaryTranslation: string
  voiceRegion?: VoiceRegion
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
}

function regionPromptLabel(voiceRegion: VoiceRegion | undefined): string {
  return voiceRegion === 'zh-TW' ? 'Taiwan Mandarin' : 'Mainland Mandarin'
}

export async function fetchNativeAlternative({
  sourceText,
  primaryTranslation,
  voiceRegion,
}: FetchNativeAlternativeParams): Promise<NativeAlternativeResult | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return null
  }

  try {
    const res = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.NATIVE_ALT_MODEL || DEFAULT_NATIVE_ALT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              `Rewrite DeepL Chinese to sound like fluent ${regionPromptLabel(
                voiceRegion,
              )} based on voiceRegion. ` +
              'Return JSON exactly shaped as { "nativeAlternative": string, "register": "formal" | "casual" | "neutral", "note"?: string }.',
          },
          {
            role: 'user',
            content:
              `English source:\n${sourceText}\n\n` +
              `DeepL Chinese:\n${primaryTranslation}`,
          },
        ],
      }),
    })

    if (!res.ok) {
      return null
    }

    const data = (await res.json()) as OpenAIChatCompletionResponse
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      return null
    }

    const parsed = parseNativeAlternativeResponse(content)
    if (!parsed || !differsFromPrimary(primaryTranslation, parsed.nativeAlternative)) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}
