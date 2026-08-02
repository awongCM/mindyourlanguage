import { lookupTerm, segment } from '@mindyourlanguage/dictionary'
import type { DictionaryEntry } from '@mindyourlanguage/shared'
import { toTraditionalChars } from './characters'
import {
  curateDictionaryMatches,
  isCommonGroundingTerm,
  MAX_SEGMENT_LOOKUPS,
  type GroundingMatchCandidate,
} from './dictionary-grounding'
import { toPinyin } from './pinyin'
import { toSpokenPinyin } from './pinyin-sandhi'

const CJK = /\p{Script=Han}/u

function fallbackCharacterSegments(translation: string): { text: string }[] {
  return [...translation]
    .filter((text) => CJK.test(text))
    .map((text) => ({ text }))
}

function collectDictionaryMatches(
  wordSegments: { text: string }[],
): DictionaryEntry[] {
  const candidates: GroundingMatchCandidate[] = []
  const seenSegments = new Set<string>()
  const seenSimplifiedMatches = new Set<string>()
  let lookupCount = 0

  for (let position = 0; position < wordSegments.length; position += 1) {
    const word = wordSegments[position]
    if (seenSegments.has(word.text)) continue
    seenSegments.add(word.text)
    if (isCommonGroundingTerm(word.text)) continue
    if (lookupCount >= MAX_SEGMENT_LOOKUPS) break

    lookupCount += 1
    try {
      const hits = lookupTerm(word.text, 1)
      const hit = hits[0]
      if (!hit || seenSimplifiedMatches.has(hit.simplified)) continue
      seenSimplifiedMatches.add(hit.simplified)
      candidates.push({
        segmentText: word.text,
        position,
        entry: hit,
      })
    } catch (err) {
      console.error('lookupTerm failed', err)
    }
  }

  return curateDictionaryMatches(candidates)
}

export function enrichChineseTranslation(translation: string): {
  pinyin: string
  spokenPinyin: string
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

  const dictionaryMatches = canLookupSegments
    ? collectDictionaryMatches(wordSegments)
    : []

  return {
    pinyin: toPinyin(translation),
    spokenPinyin: toSpokenPinyin(translation),
    traditional: toTraditionalChars(translation),
    segments,
    dictionaryMatches,
  }
}
