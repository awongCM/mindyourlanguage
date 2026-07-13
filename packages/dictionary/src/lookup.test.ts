import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseCedictLine } from './parse-line'
import { lookupTerm, setDictionaryDbPathForTests } from './lookup'

const FIXTURE_DB = path.join(__dirname, '../testdata/fixture.db')
const BAD_JSON_DB = path.join(__dirname, '../testdata/bad-json.db')
const CORRUPT_DB = path.join(__dirname, '../testdata/corrupt.db')
const SAMPLE = path.join(__dirname, '../testdata/sample-cedict.txt')

beforeAll(() => {
  for (const dbPath of [FIXTURE_DB, BAD_JSON_DB, CORRUPT_DB]) {
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

  const badJsonDb = new Database(BAD_JSON_DB)
  badJsonDb.exec(`
    CREATE TABLE entries (
      traditional TEXT NOT NULL,
      simplified TEXT NOT NULL,
      pinyin TEXT NOT NULL,
      definitions TEXT NOT NULL
    );
  `)
  badJsonDb
    .prepare(
      `INSERT INTO entries (traditional, simplified, pinyin, definitions)
       VALUES (?, ?, ?, ?)`,
    )
    .run('壞', '坏', 'huai4', 'not-json')
  badJsonDb.close()

  fs.writeFileSync(CORRUPT_DB, 'not a sqlite database')
  setDictionaryDbPathForTests(FIXTURE_DB)
})

afterAll(() => {
  setDictionaryDbPathForTests(null)
  for (const dbPath of [FIXTURE_DB, BAD_JSON_DB, CORRUPT_DB]) {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  }
})

describe('lookupTerm', () => {
  it('finds dictionary entry for 认识', () => {
    const entries = lookupTerm('认识')
    expect(entries.length).toBeGreaterThan(0)
    expect(entries[0].simplified).toBe('认识')
    expect(entries[0].definitions.length).toBeGreaterThan(0)
  })

  it('returns empty array for unknown term', () => {
    expect(lookupTerm('𠀀𠀀')).toEqual([])
  })

  it('returns empty array when a matching row has invalid definitions JSON', () => {
    setDictionaryDbPathForTests(BAD_JSON_DB)
    try {
      expect(lookupTerm('坏')).toEqual([])
    } finally {
      setDictionaryDbPathForTests(FIXTURE_DB)
    }
  })

  it('returns empty array when the dictionary database cannot be queried', () => {
    setDictionaryDbPathForTests(CORRUPT_DB)
    try {
      expect(lookupTerm('认识')).toEqual([])
    } finally {
      setDictionaryDbPathForTests(FIXTURE_DB)
    }
  })
})
