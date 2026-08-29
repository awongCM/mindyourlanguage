import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import {
  downloadCedictText,
  isCedictFetchEnabled,
  parseCedictHeader,
  resolveCedictSource,
} from '../packages/dictionary/src/cedict-source'
import { parseCedictLine } from '../packages/dictionary/src/parse-line'

const ROOT = path.resolve(__dirname, '..')
const OUT_DB = path.join(ROOT, 'data', 'cedict.db')
const PRIMARY_TXT = path.join(ROOT, 'data', 'cedict.txt')
const FALLBACK_TXT = path.join(
  ROOT,
  'archive/legacy-v1/resource/cedict_1_0_ts_utf-8_mdbg.txt',
)

async function main() {
  const source = await resolveCedictSource(
    { primaryTxt: PRIMARY_TXT, fallbackTxt: FALLBACK_TXT },
    {
      fetchEnabled: isCedictFetchEnabled(),
      download: async () => {
        try {
          return await downloadCedictText()
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.warn(`CEDICT fetch failed, using archive fallback: ${message}`)
          throw error
        }
      },
    },
  )

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

  const text = fs.readFileSync(source.path, 'utf8')
  const header = parseCedictHeader(text)
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
  console.log(
    `Imported ${count} entries from ${source.path} (${source.kind}) → ${OUT_DB}`,
  )
  if (header?.date) {
    console.log(
      `CEDICT dump date: ${header.date}; declared entries: ${header.entries}`,
    )
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
