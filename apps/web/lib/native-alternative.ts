import type { VoiceRegion } from '@mindyourlanguage/shared'

import {
  differsFromPrimary,
  parseNativeAlternativeResponse,
  type NativeAlternativeResult,
} from './native-alternative-shared'
import {
  defaultOpenAiModel,
  fetchOpenAiJsonContent,
  voiceRegionLabel,
} from './openai-json'

interface FetchNativeAlternativeParams {
  sourceText: string
  primaryTranslation: string
  voiceRegion?: VoiceRegion
}

export async function fetchNativeAlternative({
  sourceText,
  primaryTranslation,
  voiceRegion,
}: FetchNativeAlternativeParams): Promise<NativeAlternativeResult | null> {
  const content = await fetchOpenAiJsonContent({
    model: defaultOpenAiModel(process.env.NATIVE_ALT_MODEL),
    messages: [
      {
        role: 'system',
        content:
          `Rewrite DeepL Chinese to sound like fluent ${voiceRegionLabel(
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
  })

  if (!content) return null

  const parsed = parseNativeAlternativeResponse(content)
  if (!parsed || !differsFromPrimary(primaryTranslation, parsed.nativeAlternative)) {
    return null
  }

  return parsed
}
