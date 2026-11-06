import { Converter } from 'opencc-js'
import type { CharacterSet } from '@mindyourlanguage/shared'

const toTraditional = Converter({ from: 'cn', to: 'tw' })
const toSimplified = Converter({ from: 'tw', to: 'cn' })

export function toTraditionalChars(text: string): string {
  return toTraditional(text)
}

export function toSimplifiedChars(text: string): string {
  return toSimplified(text)
}

/** Show simplified or traditional Chinese for the active character set. */
export function displayForCharacterSet(
  text: string,
  characterSet: CharacterSet,
): string {
  return characterSet === 'traditional' ? toTraditionalChars(text) : text
}

/** Compare Chinese phrasebook text without caring about spaces. */
export function normalizeChineseKey(value: string): string {
  return value.replace(/\s+/g, '').trim()
}
