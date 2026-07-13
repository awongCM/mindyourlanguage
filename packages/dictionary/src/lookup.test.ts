import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseCedictLine } from './parse-line'
import { lookupTerm, setDictionaryDbPathForTests } from './lookup'

const FIXTURE_DB = path.join(__dirname, '../testdata/fixture.db')
const SAMPLE = path.join(__dirname, '../testdata/sample-cedict.txt')

beforeAll(() => {
  if (fs.existsSync(FIXTURE_DB)) fs.unlinkSync(FIXTURE_DB)
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
  setDictionaryDbPathForTests(FIXTURE_DB)
})

afterAll(() => {
  if (fs.existsSync(FIXTURE_DB)) fs.unlinkSync(FIXTURE_DB)
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
})
