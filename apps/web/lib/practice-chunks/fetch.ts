import type {
  CharacterSet,
  PracticeChunkSuggestion,
  VoiceRegion,
} from '@mindyourlanguage/shared'
import {
  defaultOpenAiModel,
  fetchOpenAiJsonContent,
  voiceRegionLabel,
} from '@/lib/openai-json'
import { MAX_PRACTICE_CHUNKS, parsePracticeChunksResponse } from './parse'

/**
 * Ask the model for clause-sized practice chunks.
 * Returns [] when the key is missing, the call fails, or the reply is unusable.
 */
export async function fetchPracticeChunks(input: {
  sourceText: string
  translation: string
  voiceRegion?: VoiceRegion
  characterSet?: CharacterSet
}): Promise<PracticeChunkSuggestion[]> {
  const characterSet = input.characterSet ?? 'simplified'
  const content = await fetchOpenAiJsonContent({
    model: defaultOpenAiModel(
      process.env.PRACTICE_CHUNKS_MODEL,
      process.env.LEARNABLES_MODEL,
      process.env.NATIVE_ALT_MODEL,
    ),
    messages: [
      {
        role: 'system',
        content:
          `Split the Chinese translation into up to ${MAX_PRACTICE_CHUNKS} short clause-sized ` +
          'practice units (~15–20 Chinese characters, one sense unit each). ' +
          `Keep fixed phrases together when they belong as one unit. Use ${voiceRegionLabel(
            input.voiceRegion,
          )} wording and ${characterSet === 'traditional' ? 'traditional' : 'simplified'} characters. ` +
          'Cover the full translation without large leftover gaps. ' +
          'Do not return the full paragraph as one item. ' +
          'For each unit provide matching English for that clause. ' +
          'Return JSON exactly shaped as { "items": [ { "english": string, "chinese": string, "pinyin"?: string } ] }.',
      },
      {
        role: 'user',
        content:
          `English source:\n${input.sourceText}\n\n` +
          `Chinese translation:\n${input.translation}`,
      },
    ],
  })

  if (!content) return []
  return parsePracticeChunksResponse(content)
}