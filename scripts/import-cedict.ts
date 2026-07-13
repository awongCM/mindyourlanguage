import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { parseCedictLine } from '../packages/dictionary/src/parse-line'

const ROOT = path.resolve(__dirname, '..')
const OUT_DB = path.join(ROOT, 'data', 'cedict.db')
const PRIMARY_TXT = path.join(ROOT, 'data', 'cedict.txt')
const FALLBACK_TXT = path.join(
  ROOT,
  'archive/legacy-v1/resource/cedict_1_0_ts_utf-8_mdbg.txt',
)

function resolveSource(): string {
  if (fs.existsSync(PRIMARY_TXT)) return PRIMARY_TXT
  if (fs.existsSync(FALLBACK_TXT)) return FALLBACK_TXT
  throw new Error(
    'No CEDICT source found. Download to data/cedict.txt or keep legacy archive file.',
  )
}

function main() {
  const source = resolveSource()
  fs.mkdirSync(path.dirname(OUT_DB), { recursive: true })
  if (fs.existsSync(OUT_DB)) fs.unlinkSync(OUT_DB)

  const db = new Database(OUT_DB)
  db.exec(`
    CREATE TABLE entries (
      traditional TEXT NOT NULL,
      simplified  TEXT NOT NULL,
      pinyin      TEXT NOT NULL,
      definitions TEXT NOT NULL
    );
    CREATE INDEX idx_simplified ON entries(simplified);
    CREATE INDEX idx_traditional ON entries(traditional);
  `)

  const insert = db.prepare(
    `INSERT INTO entries (traditional, simplified, pinyin, definitions)
     VALUES (@traditional, @simplified, @pinyin, @definitions)`,
  )

  const text = fs.readFileSync(source, 'utf8')
  const lines = text.split(/\r?\n/)
  let count = 0
  const tx = db.transaction(() => {
    for (const line of lines) {
      const parsed = parseCedictLine(line)
      if (!parsed) continue
      insert.run({
        traditional: parsed.traditional,
        simplified: parsed.simplified,
        pinyin: parsed.pinyin,
        definitions: JSON.stringify(parsed.definitions),
      })
      count++
    }
  })
  tx()
  db.close()
  console.log(`Imported ${count} entries from ${source} → ${OUT_DB}`)
}

main()
