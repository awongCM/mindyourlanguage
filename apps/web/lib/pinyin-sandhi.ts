import { convert, pinyin } from 'pinyin-pro'

interface Syllable {
  char: string
  base: string
  tone: number
}

const CJK = /\p{Script=Han}/u

function parseNumSyllable(token: string): { base: string; tone: number } {
  const match = token.match(/^([a-z]+)([0-5])$/i)
  if (!match) {
    return { base: token, tone: 0 }
  }
  return { base: match[1].toLowerCase(), tone: Number(match[2]) }
}

function getCitationSyllables(text: string): Syllable[] {
  const chars = [...text]
  const nums = pinyin(text, {
    toneType: 'num',
    type: 'array',
    toneSandhi: false,
  }) as string[]

  const syllables: Syllable[] = []
  let numIndex = 0

  for (const char of chars) {
    if (!CJK.test(char)) continue
    const token = nums[numIndex] ?? ''
    numIndex += 1
    const { base, tone } = parseNumSyllable(token)
    syllables.push({ char, base, tone })
  }

  return syllables
}

function applyBuYiSandhi(syllables: Syllable[]): void {
  for (let i = 0; i < syllables.length; i += 1) {
    const current = syllables[i]
    const next = syllables[i + 1]
    if (!next) continue

    if (current.char === '不' && current.tone === 4) {
      current.tone = next.tone === 4 ? 2 : 4
      continue
    }

    if (current.char === '一' && current.tone === 1) {
      current.tone = next.tone === 4 ? 2 : 4
    }
  }
}

function applyThirdToneSandhi(syllables: Syllable[]): void {
  let i = 0
  while (i < syllables.length) {
    if (syllables[i].tone !== 3) {
      i += 1
      continue
    }

    let end = i
    while (end + 1 < syllables.length && syllables[end + 1].tone === 3) {
      end += 1
    }

    if (end > i) {
      for (let j = i; j < end; j += 1) {
        syllables[j].tone = 2
      }
    }

    i = end + 1
  }
}

export function toSpokenPinyin(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const syllables = getCitationSyllables(trimmed)
  if (syllables.length === 0) return ''

  applyBuYiSandhi(syllables)
  applyThirdToneSandhi(syllables)

  const numbered = syllables.map((s) => `${s.base}${s.tone}`).join(' ')
  return convert(numbered)
}
