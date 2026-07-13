import type { DictionaryEntry } from '@mindyourlanguage/shared'
import { getDictionaryDb, setDictionaryDbPathForTests } from './db'

export { setDictionaryDbPathForTests }

export function lookupTerm(term: string, limit = 5): DictionaryEntry[] {
  const q = term.trim()
  if (!q) return []
  const db = getDictionaryDb()
  if (!db) return []

  const rows = db
    .prepare(
      `SELECT traditional, simplified, pinyin, definitions
       FROM entries
       WHERE simplified = ? OR traditional = ?
       LIMIT ?`,
    )
    .all(q, q, limit) as {
    traditional: string
    simplified: string
    pinyin: string
    definitions: string
  }[]

  return rows.map((row) => ({
    traditional: row.traditional,
    simplified: row.simplified,
    pinyin: row.pinyin,
    definitions: JSON.parse(row.definitions) as string[],
  }))
}
