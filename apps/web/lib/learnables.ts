import type {
  LearnableSuggestion,
  VoiceRegion,
} from '@mindyourlanguage/shared'

import {
  MAX_LEARNABLE_SUGGESTIONS,
  parseLearnablesResponse,
} from './learnables-shared'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_MODEL = 'gpt-5.6-luna'
const TIMEOUT_MS = 10_000

/**
 * Ask the model for a few new learnables.
 * Returns [] when the key is missing, the call fails, or the reply is unusable.
 */
export async function fetchLearnables(input: {
  sourceText: string
  translation: string
  knownTranslations?: string[]
  voiceRegion?: VoiceRegion
}): Promise<LearnableSuggestion[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return []

  const known = input.knownTranslations ?? []
  const region =
    input.voiceRegion === 'zh-TW' ? 'Taiwan Mandarin' : 'Mainland Mandarin'
  const knownList =
    known.length > 0 ? known.slice(0, 200).join('、') : '(none)'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model:
          process.env.LEARNABLES_MODEL ||
          process.env.NATIVE_ALT_MODEL ||
          DEFAULT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              `Pick up to ${MAX_LEARNABLE_SUGGESTIONS} NEW short Chinese learnables ` +
              `(noun, verb, or short phrase) from the translation that a learner should memorize. ` +
              `Prefer useful dialogue bits, new nouns, and new verbs in ${region}. ` +
              'Skip anything already known. Do not return the full sentence as one item. ' +
              'For each item include one short usage example. ' +
              'Return JSON exactly shaped as { "items": [ { "chinese": string, "gloss": string, ' +
              '"kind": "noun" | "verb" | "phrase", "exampleChinese": string, "exampleEnglish": string } ] }.',
          },
          {
            role: 'user',
            content:
              `English source:\n${input.sourceText}\n\n` +
              `Chinese translation:\n${input.translation}\n\n` +
              `Already known Chinese (skip these):\n${knownList}`,
          },
        ],
      }),
    })

    if (!res.ok) return []

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') return []

    return parseLearnablesResponse(content, known)
  } catch {
    return []
  } finally {
    clearTimeout(timeoutId)
  }
}
