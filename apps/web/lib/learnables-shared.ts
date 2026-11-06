import type { LearnableKind, LearnableSuggestion } from '@mindyourlanguage/shared'

export const MAX_LEARNABLE_SUGGESTIONS = 3

const LEARNABLE_KINDS: ReadonlySet<string> = new Set([
  'noun',
  'verb',
  'phrase',
])

function isLearnableKind(value: unknown): value is LearnableKind {
  return typeof value === 'string' && LEARNABLE_KINDS.has(value)
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeChineseKey(value: string): string {
  return value.replace(/\s+/g, '').trim()
}

export function filterNewLearnables(
  items: LearnableSuggestion[],
  knownTranslations: string[],
): LearnableSuggestion[] {
  const known = new Set(
    knownTranslations
      .map((text) => normalizeChineseKey(text))
      .filter((text) => text.length > 0),
  )

  const seen = new Set<string>()
  const result: LearnableSuggestion[] = []

  for (const item of items) {
    const key = normalizeChineseKey(item.chinese)
    if (!key || known.has(key) || seen.has(key)) continue
    seen.add(key)
    result.push(item)
    if (result.length >= MAX_LEARNABLE_SUGGESTIONS) break
  }

  return result
}

function parseSuggestion(value: unknown): LearnableSuggestion | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>

  const chinese = asNonEmptyString(data.chinese)
  const gloss = asNonEmptyString(data.gloss)
  const exampleChinese = asNonEmptyString(data.exampleChinese)
  const exampleEnglish = asNonEmptyString(data.exampleEnglish)
  if (!chinese || !gloss || !exampleChinese || !exampleEnglish) return null
  if (!isLearnableKind(data.kind)) return null

  return {
    chinese,
    gloss,
    kind: data.kind,
    exampleChinese,
    exampleEnglish,
  }
}

export function parseLearnablesResponse(
  content: string,
  knownTranslations: string[] = [],
): LearnableSuggestion[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return []
  }

  if (!parsed || typeof parsed !== 'object') return []

  const data = parsed as Record<string, unknown>
  const rawItems = Array.isArray(data.items) ? data.items : null
  if (!rawItems) return []

  const items: LearnableSuggestion[] = []
  for (const raw of rawItems) {
    const item = parseSuggestion(raw)
    if (item) items.push(item)
  }

  return filterNewLearnables(items, knownTranslations)
}

export function formatLearnableNotes(item: LearnableSuggestion): string {
  return `${item.exampleChinese}\n${item.exampleEnglish}`
}
