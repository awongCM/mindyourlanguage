import type {
  CharacterSet,
  PracticeChunkSuggestion,
} from '@mindyourlanguage/shared'
import { normalizeChineseKey } from '@/lib/characters'

export const MAX_PRACTICE_CHUNKS = 12

export function phrasebookFieldsFromChunk(
  item: PracticeChunkSuggestion,
  characterSet: CharacterSet,
  parentId: string,
) {
  return {
    translationId: null as null,
    sourceText: item.english,
    sourceLang: 'en' as const,
    targetLang: 'zh' as const,
    translation: item.chinese,
    pinyin: item.pinyin,
    characterSet,
    parentId,
    tags: ['chunk'],
    notes: '',
  }
}

function readChunk(raw: unknown): PracticeChunkSuggestion | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const english = typeof row.english === 'string' ? row.english.trim() : ''
  const chinese = typeof row.chinese === 'string' ? row.chinese.trim() : ''
  const pinyin =
    typeof row.pinyin === 'string' && row.pinyin.trim()
      ? row.pinyin.trim()
      : undefined
  if (!english || !chinese) return null
  return pinyin ? { english, chinese, pinyin } : { english, chinese }
}

export function parsePracticeChunksResponse(
  content: string,
): PracticeChunkSuggestion[] {
  try {
    const parsed = JSON.parse(content) as { items?: unknown }
    if (!Array.isArray(parsed.items)) return []

    const out: PracticeChunkSuggestion[] = []
    const seen = new Set<string>()
    for (const raw of parsed.items) {
      const item = readChunk(raw)
      if (!item) continue
      const key = `${item.english}::${normalizeChineseKey(item.chinese)}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
      if (out.length >= MAX_PRACTICE_CHUNKS) break
    }
    return out
  } catch {
    return []
  }
}