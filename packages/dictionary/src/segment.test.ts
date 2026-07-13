import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseCedictLine } from './parse-line'
import { setDictionaryDbPathForTests } from './lookup'
import { clearSegmentCacheForTests, segment } from './segment'

const FIXTURE_DB = path.join(__dirname, '../testdata/segment-fixture.db')
const CORRUPT_DB = path.join(__dirname, '../testdata/segment-corrupt.db')
const SAMPLE = path.join(__dirname, '../testdata/sample-cedict.txt')

beforeAll(() => {
  for (const dbPath of [FIXTURE_DB, CORRUPT_DB]) {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  }

  const db = new Database(FIXTURE_DB)
  db.exec(`
    CREATE TABLE entries (
      traditional TEXT NOT NULL,
      simplified TEXT NOT NULL,
      pinyin TEXT NOT NULL,
      definitions TEXT NOT NULL
    );
    CREATE INDEX idx_simplified ON entries(simplified);
    CREATE INDEX idx_traditional ON entries(traditional);
  `)
  const insert = db.prepare(
    `INSERT INTO entries (traditional, simplified, pinyin, definitions)
     VALUES (?, ?, ?, ?)`,
  )
  for (const line of fs.readFileSync(SAMPLE, 'utf8').split(/\r?\n/)) {
    const parsed = parseCedictLine(line)
    if (!parsed) continue
    insert.run(
      parsed.traditional,
      parsed.simplified,
      parsed.pinyin,
      JSON.stringify(parsed.definitions),
    )
  }
  db.close()

  fs.writeFileSync(CORRUPT_DB, 'not a sqlite database')
  setDictionaryDbPathForTests(FIXTURE_DB)
  clearSegmentCacheForTests()
})

afterAll(() => {
  setDictionaryDbPathForTests(null)
  clearSegmentCacheForTests()
  for (const dbPath of [FIXTURE_DB, CORRUPT_DB]) {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  }
})

describe('segment', () => {
  it('returns longest dictionary words from CJK text', () => {
    expect(segment('认识世界')).toEqual([{ text: '认识' }, { text: '世界' }])
  })

  it('falls back to a single unknown CJK character', () => {
    expect(segment('认识𠀀')).toEqual([{ text: '认识' }, { text: '𠀀' }])
  })

  it('falls back to single Han characters when the dictionary database is corrupt', () => {
    setDictionaryDbPathForTests(CORRUPT_DB)
    clearSegmentCacheForTests()
    try {
      expect(segment('认识')).toEqual([{ text: '认' }, { text: '识' }])
    } finally {
      setDictionaryDbPathForTests(FIXTURE_DB)
      clearSegmentCacheForTests()
    }
  })
})
