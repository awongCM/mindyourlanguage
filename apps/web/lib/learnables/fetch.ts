import type {
  LearnableSuggestion,
  VoiceRegion,
} from '@mindyourlanguage/shared'
import {
  defaultOpenAiModel,
  fetchOpenAiJsonContent,
  voiceRegionLabel,
} from '@/lib/openai-json'
import {
  MAX_LEARNABLE_SUGGESTIONS,
  parseLearnablesResponse,
} from './parse'

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
  const known = input.knownTranslations ?? []
  const knownList =
    known.length > 0 ? known.slice(0, 200).join('、') : '(none)'

  const content = await fetchOpenAiJsonContent({
    model: defaultOpenAiModel(
      process.env.LEARNABLES_MODEL,
      process.env.NATIVE_ALT_MODEL,
    ),
    messages: [
      {
        role: 'system',
        content:
          `Pick up to ${MAX_LEARNABLE_SUGGESTIONS} NEW short Chinese learnables ` +
          `(noun, verb, or short phrase) from the translation that a learner should memorize. ` +
          `Prefer useful dialogue bits, new nouns, and new verbs in ${voiceRegionLabel(
            input.voiceRegion,
          )}. ` +
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
  })

  if (!content) return []
  return parseLearnablesResponse(content, known)
}
