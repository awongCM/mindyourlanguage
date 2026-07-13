import { getDictionaryDb } from './db'

const CJK = /\p{Script=Han}/u
const MAX_WORD_LEN = 8

let wordSetCache: Set<string> | null = null

function getWordSet(): Set<string> {
  try {
    const db = getDictionaryDb()
    if (!db) return new Set()
    if (wordSetCache) return wordSetCache
    const rows = db
      .prepare(
        `SELECT DISTINCT simplified AS w FROM entries
         UNION
         SELECT DISTINCT traditional AS w FROM entries`,
      )
      .all() as { w: string }[]
    wordSetCache = new Set(rows.map((r) => r.w))
    return wordSetCache
  } catch {
    return new Set()
  }
}

export function clearSegmentCacheForTests() {
  wordSetCache = null
}

export function segment(text: string): { text: string }[] {
  const words = getWordSet()
  const chars = [...text]
  const out: { text: string }[] = []
  let i = 0
  while (i < chars.length) {
    const ch = chars[i]
    if (!CJK.test(ch)) {
      i++
      continue
    }
    const maxLen = Math.min(MAX_WORD_LEN, chars.length - i)
    let matched = chars[i]
    let matchedLen = 1
    for (let len = maxLen; len >= 1; len--) {
      const slice = chars.slice(i, i + len).join('')
      if (len === 1 || words.has(slice)) {
        matched = slice
        matchedLen = len
        break
      }
    }
    out.push({ text: matched })
    i += matchedLen
  }
  return out
}
