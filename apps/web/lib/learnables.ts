import type {
  LearnableSuggestion,
  VoiceRegion,
} from '@mindyourlanguage/shared'

import {
  MAX_LEARNABLE_SUGGESTIONS,
  parseLearnablesResponse,
} from './learnables-shared'

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_LEARNABLES_MODEL = 'gpt-5.6-luna'
const LEARNABLES_FETCH_TIMEOUT_MS = 10_000
const MAX_KNOWN_IN_PROMPT = 200

interface FetchLearnablesParams {
  sourceText: string
  translation: string
  knownTranslations?: string[]
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

function learnablesModel(): string {
  return (
    process.env.LEARNABLES_MODEL ||
    process.env.NATIVE_ALT_MODEL ||
    DEFAULT_LEARNABLES_MODEL
  )
}

function buildMessages({
  sourceText,
  translation,
  knownTranslations,
  voiceRegion,
}: Required<
  Pick<
    FetchLearnablesParams,
    'sourceText' | 'translation' | 'knownTranslations' | 'voiceRegion'
  >
>) {
  const knownList =
    knownTranslations.length > 0
      ? knownTranslations.slice(0, MAX_KNOWN_IN_PROMPT).join('、')
      : '(none)'

  return [
    {
      role: 'system' as const,
      content:
        `Pick up to ${MAX_LEARNABLE_SUGGESTIONS} NEW short Chinese learnables ` +
        `(noun, verb, or short phrase) from the translation that a learner should memorize. ` +
        `Prefer useful dialogue bits, new nouns, and new verbs in ${regionPromptLabel(
          voiceRegion,
        )}. ` +
        'Skip anything already known. Do not return the full sentence as one item. ' +
        'For each item include one short usage example. ' +
        'Return JSON exactly shaped as { "items": [ { "chinese": string, "gloss": string, ' +
        '"kind": "noun" | "verb" | "phrase", "exampleChinese": string, "exampleEnglish": string } ] }.',
    },
    {
      role: 'user' as const,
      content:
        `English source:\n${sourceText}\n\n` +
        `Chinese translation:\n${translation}\n\n` +
        `Already known Chinese (skip these):\n${knownList}`,
    },
  ]
}

function contentFromOpenAI(data: OpenAIChatCompletionResponse): string | null {
  const content = data.choices?.[0]?.message?.content
  return typeof content === 'string' ? content : null
}

/** Asks the model for a few new learnables. Returns [] when unavailable. */
export async function fetchLearnables({
  sourceText,
  translation,
  knownTranslations = [],
  voiceRegion = 'zh-CN',
}: FetchLearnablesParams): Promise<LearnableSuggestion[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return []

  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    LEARNABLES_FETCH_TIMEOUT_MS,
  )

  try {
    const res = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: learnablesModel(),
        response_format: { type: 'json_object' },
        messages: buildMessages({
          sourceText,
          translation,
          knownTranslations,
          voiceRegion,
        }),
      }),
    })

    if (!res.ok) return []

    const content = contentFromOpenAI(
      (await res.json()) as OpenAIChatCompletionResponse,
    )
    if (!content) return []

    return parseLearnablesResponse(content, knownTranslations)
  } catch {
    return []
  } finally {
    clearTimeout(timeoutId)
  }
}
