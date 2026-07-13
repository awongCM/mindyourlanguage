import { Converter } from 'opencc-js'

const toTraditional = Converter({ from: 'cn', to: 'tw' })
const toSimplified = Converter({ from: 'tw', to: 'cn' })

export function toTraditionalChars(text: string): string {
  return toTraditional(text)
}

export function toSimplifiedChars(text: string): string {
  return toSimplified(text)
}
