import { lookupTerm, segment } from '@mindyourlanguage/dictionary'
import type { DictionaryEntry } from '@mindyourlanguage/shared'
import { toTraditionalChars } from './characters'
import { toPinyin } from './pinyin'

const MAX_MATCHES = 15
const CJK = /\p{Script=Han}/u

function fallbackCharacterSegments(translation: string): { text: string }[] {
  return [...translation]
    .filter((text) => CJK.test(text))
    .map((text) => ({ text }))
}

export function enrichChineseTranslation(translation: string): {
  pinyin: string
  traditional: string
  segments: { text: string; pinyin: string }[]
  dictionaryMatches: DictionaryEntry[]
} {
  let wordSegments: { text: string }[] = []
  let canLookupSegments = true

  try {
    wordSegments = segment(translation)
  } catch (err) {
    console.error('segment failed', err)
    canLookupSegments = false
    wordSegments = fallbackCharacterSegments(translation)
  }

  const segments = wordSegments.map((word) => ({
    text: word.text,
    pinyin: toPinyin(word.text),
  }))

  const dictionaryMatches: DictionaryEntry[] = []
  if (canLookupSegments) {
    const seenSegments = new Set<string>()
    const seenSimplifiedMatches = new Set<string>()

    for (const word of wordSegments) {
      if (dictionaryMatches.length >= MAX_MATCHES) break
      if (seenSegments.has(word.text)) continue
      seenSegments.add(word.text)

      try {
        const hits = lookupTerm(word.text, 1)
        const hit = hits[0]
        if (!hit || seenSimplifiedMatches.has(hit.simplified)) continue
        seenSimplifiedMatches.add(hit.simplified)
        dictionaryMatches.push(hit)
      } catch (err) {
        console.error('lookupTerm failed', err)
      }
    }
  }

  return {
    pinyin: toPinyin(translation),
    traditional: toTraditionalChars(translation),
    segments,
    dictionaryMatches,
  }
}
