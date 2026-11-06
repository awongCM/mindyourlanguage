import type {
  CharacterSet,
  LearnableKind,
  LearnableSuggestion,
} from '@mindyourlanguage/shared'

/** Cap so spaced repetition stays light. */
export const MAX_LEARNABLE_SUGGESTIONS = 3

/** Fields used when saving a suggestion as a phrasebook / SRS card. */
export function phrasebookFieldsFromLearnable(
  item: LearnableSuggestion,
  characterSet: CharacterSet,
) {
  return {
    translationId: null as null,
    sourceText: item.gloss,
    sourceLang: 'en' as const,
    targetLang: 'zh' as const,
    translation: item.chinese,
    characterSet,
    tags: [item.kind],
    notes: `${item.exampleChinese}\n${item.exampleEnglish}`,
  }
}

const KINDS = new Set<string>(['noun', 'verb', 'phrase'])

/** Compare Chinese phrasebook text without caring about spaces. */
export function normalizeChineseKey(value: string): string {
  return value.replace(/\s+/g, '').trim()
}

/** Drop known/duplicate items and keep at most {@link MAX_LEARNABLE_SUGGESTIONS}. */
export function filterNewLearnables(
  items: LearnableSuggestion[],
  knownTranslations: string[],
): LearnableSuggestion[] {
  const known = new Set(
    knownTranslations.map(normalizeChineseKey).filter(Boolean),
  )
  const out: LearnableSuggestion[] = []

  for (const item of items) {
    const key = normalizeChineseKey(item.chinese)
    if (!key || known.has(key)) continue
    known.add(key)
    out.push(item)
    if (out.length >= MAX_LEARNABLE_SUGGESTIONS) break
  }

  return out
}

function readSuggestion(raw: unknown): LearnableSuggestion | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>

  const chinese = typeof row.chinese === 'string' ? row.chinese.trim() : ''
  const gloss = typeof row.gloss === 'string' ? row.gloss.trim() : ''
  const exampleChinese =
    typeof row.exampleChinese === 'string' ? row.exampleChinese.trim() : ''
  const exampleEnglish =
    typeof row.exampleEnglish === 'string' ? row.exampleEnglish.trim() : ''
  const kind = typeof row.kind === 'string' ? row.kind : ''

  if (!chinese || !gloss || !exampleChinese || !exampleEnglish) return null
  if (!KINDS.has(kind)) return null

  return {
    chinese,
    gloss,
    kind: kind as LearnableKind,
    exampleChinese,
    exampleEnglish,
  }
}

/** Parse model JSON, then apply the known/cap filter. */
export function parseLearnablesResponse(
  content: string,
  knownTranslations: string[] = [],
): LearnableSuggestion[] {
  try {
    const parsed = JSON.parse(content) as { items?: unknown }
    if (!Array.isArray(parsed.items)) return []

    const items: LearnableSuggestion[] = []
    for (const raw of parsed.items) {
      const item = readSuggestion(raw)
      if (item) items.push(item)
    }
    return filterNewLearnables(items, knownTranslations)
  } catch {
    return []
  }
}
