# Phase 2 Dictionary + Native Alternative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship sequenced Option C — CEDICT dictionary grounding (PR 2a) then EN→ZH native alternative via OpenAI (PR 2b) — so intermediate Mandarin practice gets word-level definitions and fluent phrasing rewrites before TTS.

**Architecture:** Server-side `packages/dictionary` owns SQLite CEDICT lookup + longest-match segmentation. `POST /api/translate` enriches ZH targets with word segments and up to 15 dictionary matches. PR 2b adds an optional OpenAI rewrite behind `includeNativeAlternative`, isolated in `lib/native-alternative.ts`, never blocking the DeepL primary result.

**Tech Stack:** Next.js 16, TypeScript, better-sqlite3, CC-CEDICT, OpenAI Chat Completions (JSON), Vitest, existing shadcn/ui Card/Button patterns.

**Design spec:** `docs/superpowers/specs/2026-07-13-phase-2-dictionary-native-alternative-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `scripts/import-cedict.ts` | Parse CC-CEDICT text → `data/cedict.db` |
| `data/.gitkeep` | Keep data dir in git (DB is gitignored) |
| `packages/dictionary/package.json` | Package deps (`better-sqlite3`, vitest) |
| `packages/dictionary/src/db.ts` | Open SQLite connection from `CEDICT_DB_PATH` |
| `packages/dictionary/src/parse-line.ts` | Parse one CEDICT line |
| `packages/dictionary/src/lookup.ts` | `lookupTerm` |
| `packages/dictionary/src/segment.ts` | Longest-match `segment` |
| `packages/dictionary/src/index.ts` | Public exports |
| `packages/dictionary/testdata/sample-cedict.txt` | Tiny fixture for unit tests |
| `apps/web/app/api/dictionary/route.ts` | `GET /api/dictionary` |
| `apps/web/lib/enrich-translation.ts` | Add dictionary matches + word segments |
| `apps/web/components/grounding-panel.tsx` | Grounding UI |
| `packages/shared/src/types.ts` | `includeNativeAlternative`, native response fields |
| `apps/web/lib/native-alternative.ts` | OpenAI rewrite + parse + differs helper |
| `apps/web/components/native-alternative-card.tsx` | Alternative + register UI |
| `apps/web/app/page.tsx` | Wire panels + native toggle |
| `apps/web/.env.example` | Document env vars |
| `apps/web/next.config.ts` | `transpilePackages` + `serverExternalPackages` for better-sqlite3 |

---

## PR 2a — Dictionary grounding

### Task 1: CEDICT line parser + importer scaffold

**Files:**
- Create: `packages/dictionary/src/parse-line.ts`
- Create: `packages/dictionary/src/parse-line.test.ts`
- Create: `packages/dictionary/testdata/sample-cedict.txt`
- Create: `scripts/import-cedict.ts`
- Create: `data/.gitkeep`
- Modify: `packages/dictionary/package.json`
- Modify: `.gitignore` (ignore `data/cedict.txt` if missing)
- Modify: `package.json` (ensure `import-cedict` script; add test workspace script later)

- [ ] **Step 1: Add sample fixture**

Create `packages/dictionary/testdata/sample-cedict.txt`:

```
# CC-CEDICT sample fixture
认识 认识 [ren4 shi5] /to know/to recognize/to be familiar with/to get acquainted with sb/
高興 高兴 [gao1 xing4] /happy/glad/willing (to do sth)/in a cheerful mood/
你好 你好 [ni3 hao3] /hello/hi/
世界 世界 [shi4 jie4] /world/
```

- [ ] **Step 2: Write failing parser test**

Create `packages/dictionary/src/parse-line.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseCedictLine } from './parse-line'

describe('parseCedictLine', () => {
  it('parses a standard CEDICT entry', () => {
    const entry = parseCedictLine(
      '認識 认识 [ren4 shi5] /to know/to recognize/',
    )
    expect(entry).toEqual({
      traditional: '認識',
      simplified: '认识',
      pinyin: 'ren4 shi5',
      definitions: ['to know', 'to recognize'],
    })
  })

  it('returns null for comments and empty lines', () => {
    expect(parseCedictLine('# comment')).toBeNull()
    expect(parseCedictLine('')).toBeNull()
  })
})
```

- [ ] **Step 3: Run test — expect FAIL**

Run:

```bash
cd /workspace/packages/dictionary && npx vitest run src/parse-line.test.ts
```

Expected: FAIL — module not found / vitest not configured.

- [ ] **Step 4: Configure dictionary package + implement parser**

Update `packages/dictionary/package.json`:

```json
{
  "name": "@mindyourlanguage/dictionary",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@mindyourlanguage/shared": "*",
    "better-sqlite3": "^11.10.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "vitest": "^4.1.10"
  }
}
```

Create `packages/dictionary/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

Create `packages/dictionary/src/parse-line.ts`:

```typescript
export interface CedictParsedLine {
  traditional: string
  simplified: string
  pinyin: string
  definitions: string[]
}

const LINE_RE =
  /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/

export function parseCedictLine(line: string): CedictParsedLine | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const match = LINE_RE.exec(trimmed)
  if (!match) return null
  const [, traditional, simplified, pinyin, defs] = match
  const definitions = defs
    .split('/')
    .map((d) => d.trim())
    .filter(Boolean)
  if (definitions.length === 0) return null
  return { traditional, simplified, pinyin, definitions }
}
```

- [ ] **Step 5: Run parser test — expect PASS**

```bash
cd /workspace && npm install
cd packages/dictionary && npx vitest run src/parse-line.test.ts
```

Expected: PASS

- [ ] **Step 6: Write importer script**

Create `data/.gitkeep` (empty).

Ensure `.gitignore` contains:

```
data/cedict.db
data/cedict.txt
```

Create `scripts/import-cedict.ts`:

```typescript
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
```

- [ ] **Step 7: Smoke-run importer against fixture path (optional local check)**

For a quick sanity check you can temporarily point at the sample, or run full import:

```bash
cd /workspace && npx tsx scripts/import-cedict.ts
```

Expected: logs imported entry count; creates `data/cedict.db`.

- [ ] **Step 8: Commit**

```bash
git add packages/dictionary scripts/import-cedict.ts data/.gitkeep .gitignore package-lock.json
git commit -m "feat: add CEDICT line parser and SQLite import script"
```

---

### Task 2: `lookupTerm` against SQLite

**Files:**
- Create: `packages/dictionary/src/db.ts`
- Create: `packages/dictionary/src/lookup.ts`
- Create: `packages/dictionary/src/lookup.test.ts`
- Create: `packages/dictionary/scripts/build-fixture-db.ts` (or inline fixture build in test setup)
- Modify: `packages/dictionary/src/index.ts`

- [ ] **Step 1: Write failing lookup test**

Create `packages/dictionary/src/lookup.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /workspace/packages/dictionary && npx vitest run src/lookup.test.ts
```

Expected: FAIL — `lookup` not found.

- [ ] **Step 3: Implement db + lookup**

Create `packages/dictionary/src/db.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

let overridePath: string | null = null
let cached: Database.Database | null = null
let cachedPath: string | null = null

export function setDictionaryDbPathForTests(dbPath: string | null) {
  overridePath = dbPath
  if (cached) {
    cached.close()
    cached = null
    cachedPath = null
  }
}

export function resolveDictionaryDbPath(): string {
  if (overridePath) return overridePath
  if (process.env.CEDICT_DB_PATH) return path.resolve(process.env.CEDICT_DB_PATH)
  // apps/web cwd → repo data/; scripts cwd → repo data/
  const candidates = [
    path.resolve(process.cwd(), 'data/cedict.db'),
    path.resolve(process.cwd(), '../../data/cedict.db'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return candidates[0]
}

export function getDictionaryDb(): Database.Database | null {
  const dbPath = resolveDictionaryDbPath()
  if (!fs.existsSync(dbPath)) return null
  if (cached && cachedPath === dbPath) return cached
  if (cached) cached.close()
  cached = new Database(dbPath, { readonly: true, fileMustExist: true })
  cachedPath = dbPath
  return cached
}
```

Create `packages/dictionary/src/lookup.ts`:

```typescript
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
```

Update `packages/dictionary/src/index.ts`:

```typescript
export { parseCedictLine } from './parse-line'
export type { CedictParsedLine } from './parse-line'
export { lookupTerm, setDictionaryDbPathForTests } from './lookup'
export { getDictionaryDb, resolveDictionaryDbPath } from './db'
```

- [ ] **Step 4: Run lookup tests — expect PASS**

```bash
cd /workspace/packages/dictionary && npx vitest run src/lookup.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dictionary/
git commit -m "feat: add CEDICT SQLite lookupTerm"
```

---

### Task 3: Longest-match word segmentation

**Files:**
- Create: `packages/dictionary/src/segment.ts`
- Create: `packages/dictionary/src/segment.test.ts`
- Modify: `packages/dictionary/src/index.ts`
- Modify: `packages/dictionary/src/db.ts` (optional: load word set cache)

- [ ] **Step 1: Write failing segment test**

Create `packages/dictionary/src/segment.test.ts` (reuse fixture DB setup from lookup test — extract shared `testdata/setup-fixture.ts` if duplication hurts; otherwise duplicate the beforeAll block):

```typescript
import { describe, expect, it } from 'vitest'
import { segment } from './segment'
// assume fixture DB path already set via shared setup or duplicate beforeAll from lookup.test.ts

describe('segment', () => {
  it('segments 认识你 using longest CEDICT match', () => {
    // Requires fixture to include 认识 and preferably single chars as fallback
    const parts = segment('认识世界')
    expect(parts.map((p) => p.text)).toEqual(['认识', '世界'])
  })

  it('falls back to single characters for unknown runs', () => {
    const parts = segment('认识𠀀')
    expect(parts[0].text).toBe('认识')
    expect(parts[1].text).toBe('𠀀')
  })
})
```

Also add single-character lines to `sample-cedict.txt` if needed for fallback lookups of 你 etc., OR implement character fallback without requiring dict presence (preferred): unknown CJK char → one-char segment with empty pinyin filled later by `pinyin-pro` in the web enricher.

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /workspace/packages/dictionary && npx vitest run src/segment.test.ts
```

Expected: FAIL — `segment` not found.

- [ ] **Step 3: Implement longest-match segmenter**

Create `packages/dictionary/src/segment.ts`:

```typescript
import { getDictionaryDb } from './db'

const CJK = /[\u4e00-\u9fff]/
const MAX_WORD_LEN = 8

let wordSetCache: Set<string> | null = null

function getWordSet(): Set<string> {
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
    for (let len = maxLen; len >= 1; len--) {
      const slice = chars.slice(i, i + len).join('')
      if (len === 1 || words.has(slice)) {
        matched = slice
        break
      }
    }
    out.push({ text: matched })
    i += matched.length
  }
  return out
}
```

Export `segment` and `clearSegmentCacheForTests` from `index.ts`. Call `clearSegmentCacheForTests()` in test `beforeAll` after setting DB path.

- [ ] **Step 4: Run segment tests — expect PASS**

```bash
cd /workspace/packages/dictionary && npx vitest run src/segment.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dictionary/
git commit -m "feat: add longest-match CEDICT word segmentation"
```

---

### Task 4: `GET /api/dictionary` + Next.js sqlite wiring

**Files:**
- Create: `apps/web/app/api/dictionary/route.ts`
- Create: `apps/web/app/api/dictionary/route.test.ts`
- Modify: `apps/web/package.json` (depend on `@mindyourlanguage/dictionary`)
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Wire Next config + dependency**

Update `apps/web/package.json` dependencies:

```json
"@mindyourlanguage/dictionary": "*",
"@mindyourlanguage/shared": "*"
```

Update `apps/web/next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@mindyourlanguage/shared",
    "@mindyourlanguage/dictionary",
  ],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

Run `npm install` from repo root.

- [ ] **Step 2: Write failing API test**

Create `apps/web/app/api/dictionary/route.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@mindyourlanguage/dictionary', () => ({
  lookupTerm: vi.fn().mockReturnValue([
    {
      simplified: '认识',
      traditional: '認識',
      pinyin: 'ren4 shi5',
      definitions: ['to know'],
    },
  ]),
}))

import { GET } from './route'
import { lookupTerm } from '@mindyourlanguage/dictionary'

describe('GET /api/dictionary', () => {
  beforeEach(() => {
    vi.mocked(lookupTerm).mockClear()
  })

  it('returns entries for q', async () => {
    const req = new Request('http://localhost/api/dictionary?q=认识&limit=5')
    const res = await GET(req as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.entries[0].simplified).toBe('认识')
    expect(lookupTerm).toHaveBeenCalledWith('认识', 5)
  })

  it('returns 400 when q missing', async () => {
    const req = new Request('http://localhost/api/dictionary')
    const res = await GET(req as any)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
cd /workspace/apps/web && npx vitest run app/api/dictionary/route.test.ts
```

Expected: FAIL — route missing.

- [ ] **Step 4: Implement route**

Create `apps/web/app/api/dictionary/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { lookupTerm } from '@mindyourlanguage/dictionary'

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 20

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) {
    return NextResponse.json({ error: 'q is required' }, { status: 400 })
  }
  const rawLimit = Number(req.nextUrl.searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.floor(rawLimit)), MAX_LIMIT)
    : DEFAULT_LIMIT

  try {
    const entries = lookupTerm(q, limit)
    return NextResponse.json({ entries })
  } catch (err) {
    console.error('dictionary lookup failed', err)
    return NextResponse.json({ entries: [] })
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd /workspace/apps/web && npx vitest run app/api/dictionary/route.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/dictionary apps/web/next.config.ts apps/web/package.json package-lock.json
git commit -m "feat: add GET /api/dictionary CEDICT lookup route"
```

---

### Task 5: Enrich translate API with dictionary matches + word segments

**Files:**
- Modify: `apps/web/lib/enrich-translation.ts`
- Modify: `apps/web/lib/enrich-translation.test.ts`
- Modify: `apps/web/app/api/translate/route.ts`
- Modify: `apps/web/app/api/translate/route.test.ts`
- Modify: `apps/web/lib/pinyin.ts` (keep `toPinyin`; char-level `segmentChinese` may remain for tests or become unused)

- [ ] **Step 1: Write failing enrich test**

Update/extend `apps/web/lib/enrich-translation.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@mindyourlanguage/dictionary', () => ({
  segment: vi.fn().mockReturnValue([{ text: '认识' }, { text: '你' }]),
  lookupTerm: vi.fn().mockImplementation((term: string) => {
    if (term === '认识') {
      return [
        {
          simplified: '认识',
          traditional: '認識',
          pinyin: 'ren4 shi5',
          definitions: ['to know'],
        },
      ]
    }
    return []
  }),
}))

vi.mock('./characters', () => ({
  toTraditionalChars: (t: string) => t,
}))

vi.mock('./pinyin', () => ({
  toPinyin: (t: string) => `py:${t}`,
}))

import { enrichChineseTranslation } from './enrich-translation'
import { lookupTerm, segment } from '@mindyourlanguage/dictionary'

describe('enrichChineseTranslation', () => {
  beforeEach(() => {
    vi.mocked(segment).mockClear()
    vi.mocked(lookupTerm).mockClear()
  })

  it('returns word segments and dictionary matches', () => {
    const result = enrichChineseTranslation('认识你')
    expect(segment).toHaveBeenCalledWith('认识你')
    expect(result.segments[0]).toEqual({ text: '认识', pinyin: 'py:认识' })
    expect(result.dictionaryMatches).toHaveLength(1)
    expect(result.dictionaryMatches[0].simplified).toBe('认识')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /workspace/apps/web && npx vitest run lib/enrich-translation.test.ts
```

Expected: FAIL — `dictionaryMatches` missing from enrich result.

- [ ] **Step 3: Implement enrichment**

Replace `apps/web/lib/enrich-translation.ts`:

```typescript
import { lookupTerm, segment } from '@mindyourlanguage/dictionary'
import type { DictionaryEntry } from '@mindyourlanguage/shared'
import { toTraditionalChars } from './characters'
import { toPinyin } from './pinyin'

const MAX_MATCHES = 15

export function enrichChineseTranslation(translation: string): {
  pinyin: string
  traditional: string
  segments: { text: string; pinyin: string }[]
  dictionaryMatches: DictionaryEntry[]
} {
  const wordSegments = segment(translation)
  const segments = wordSegments.map((w) => ({
    text: w.text,
    pinyin: toPinyin(w.text),
  }))

  const seen = new Set<string>()
  const dictionaryMatches: DictionaryEntry[] = []
  for (const w of wordSegments) {
    if (dictionaryMatches.length >= MAX_MATCHES) break
    if (seen.has(w.text)) continue
    seen.add(w.text)
    const hits = lookupTerm(w.text, 1)
    if (hits[0]) dictionaryMatches.push(hits[0])
  }

  return {
    pinyin: toPinyin(translation),
    traditional: toTraditionalChars(translation),
    segments,
    dictionaryMatches,
  }
}
```

Update `apps/web/app/api/translate/route.ts` to pass through `dictionaryMatches` from enrichment instead of `[]`:

```typescript
    const enrichment =
      body.targetLang === 'zh' ? enrichChineseTranslation(text) : undefined

    return NextResponse.json({
      id: randomUUID(),
      translation: text,
      detectedLang: body.sourceLang,
      segments: enrichment?.segments ?? [],
      dictionaryMatches: enrichment?.dictionaryMatches ?? [],
      ...(enrichment
        ? { pinyin: enrichment.pinyin, traditional: enrichment.traditional }
        : {}),
    })
```

Wrap dictionary usage inside `enrichChineseTranslation` with try/catch if desired so DB errors yield empty matches — preferred:

```typescript
  let wordSegments: { text: string }[] = []
  try {
    wordSegments = segment(translation)
  } catch (err) {
    console.error('segment failed', err)
  }
```

Update translate route test mock:

```typescript
vi.mock('@/lib/enrich-translation', () => ({
  enrichChineseTranslation: vi.fn().mockReturnValue({
    pinyin: 'nǐ hǎo',
    traditional: '你好',
    segments: [{ text: '你好', pinyin: 'nǐ hǎo' }],
    dictionaryMatches: [
      {
        simplified: '你好',
        traditional: '你好',
        pinyin: 'ni3 hao3',
        definitions: ['hello'],
      },
    ],
  }),
}))
```

Add assertion `expect(body.dictionaryMatches).toHaveLength(1)` in the happy-path test.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /workspace/apps/web && npx vitest run lib/enrich-translation.test.ts app/api/translate/route.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/enrich-translation.ts apps/web/lib/enrich-translation.test.ts apps/web/app/api/translate/
git commit -m "feat: enrich translate API with CEDICT matches and word segments"
```

---

### Task 6: Grounding panel UI

**Files:**
- Create: `apps/web/components/grounding-panel.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Build `grounding-panel.tsx`**

```tsx
"use client";

import type { DictionaryEntry } from "@mindyourlanguage/shared";

interface GroundingPanelProps {
  entries: DictionaryEntry[];
}

export function GroundingPanel({ entries }: GroundingPanelProps) {
  if (entries.length === 0) {
    return (
      <section aria-label="Dictionary grounding" className="text-sm text-muted-foreground">
        No dictionary matches for this translation.
      </section>
    );
  }

  return (
    <section aria-label="Dictionary grounding" className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-foreground">Dictionary grounding</h2>
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => (
          <li key={`${entry.simplified}-${entry.pinyin}`} className="text-sm">
            <p className="text-foreground">
              <span className="font-medium">{entry.simplified}</span>
              {entry.traditional !== entry.simplified ? (
                <span className="ml-2 text-muted-foreground">{entry.traditional}</span>
              ) : null}
              <span className="ml-2 text-muted-foreground" lang="zh-Latn">
                {entry.pinyin}
              </span>
            </p>
            <p className="text-muted-foreground">{entry.definitions.join("; ")}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Wire into `page.tsx`**

Below `<ResultCard />`:

```tsx
{result ? (
  <>
    <ResultCard result={result} characterSet={characterSet} />
    <GroundingPanel entries={result.dictionaryMatches} />
  </>
) : null}
```

- [ ] **Step 3: Manual smoke (when DeepL + cedict.db available)**

```bash
cd /workspace && npx tsx scripts/import-cedict.ts
npm run dev
```

Translate “Nice to meet you.” EN→ZH. Expect word chips + grounding rows (e.g. 认识 / 高兴 family terms depending on DeepL output).

- [ ] **Step 4: Commit (closes PR 2a work on this branch)**

```bash
git add apps/web/components/grounding-panel.tsx apps/web/app/page.tsx
git commit -m "feat: add dictionary grounding panel to translator UI"
```

---

## PR 2b — Native alternative

### Task 7: Extend shared translate types

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/types.test.ts`

- [ ] **Step 1: Extend types**

In `packages/shared/src/types.ts`:

```typescript
export interface TranslateRequest {
  text: string
  sourceLang: Lang
  targetLang: Lang
  characterSet: CharacterSet
  includeNativeAlternative?: boolean
  voiceRegion?: VoiceRegion
}

export interface TranslateResponse {
  id: string
  translation: string
  traditional?: string
  pinyin?: string
  detectedLang: Lang
  segments: TranslationSegment[]
  dictionaryMatches: DictionaryEntry[]
  nativeAlternative?: string
  register?: Register
  nativeNote?: string
}
```

- [ ] **Step 2: Extend type test to include optional native fields on a record/response shape**

- [ ] **Step 3: Run tests**

```bash
cd /workspace/packages/shared && npx vitest run src/types.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat: extend translate types for native alternative"
```

---

### Task 8: Native alternative lib (OpenAI + helpers)

**Files:**
- Create: `apps/web/lib/native-alternative.ts`
- Create: `apps/web/lib/native-alternative.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  differsFromPrimary,
  parseNativeAlternativeResponse,
  fetchNativeAlternative,
  registerLabel,
} from './native-alternative'

describe('differsFromPrimary', () => {
  it('treats whitespace-normalized equals as same', () => {
    expect(differsFromPrimary('你好', ' 你好 ')).toBe(false)
  })
  it('detects real differences', () => {
    expect(differsFromPrimary('你好', '嗨')).toBe(true)
  })
})

describe('parseNativeAlternativeResponse', () => {
  it('parses valid JSON payload', () => {
    const parsed = parseNativeAlternativeResponse(
      JSON.stringify({
        nativeAlternative: '嗨',
        register: 'casual',
        note: 'more colloquial',
      }),
    )
    expect(parsed).toEqual({
      nativeAlternative: '嗨',
      register: 'casual',
      note: 'more colloquial',
    })
  })

  it('returns null for invalid register', () => {
    expect(
      parseNativeAlternativeResponse(
        JSON.stringify({ nativeAlternative: 'x', register: 'nope' }),
      ),
    ).toBeNull()
  })
})

describe('registerLabel', () => {
  it('maps registers to Chinese labels', () => {
    expect(registerLabel('formal')).toBe('书面')
    expect(registerLabel('casual')).toBe('口语')
    expect(registerLabel('neutral')).toBe('中性')
  })
})

describe('fetchNativeAlternative', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.NATIVE_ALT_MODEL = 'gpt-4o-mini'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns parsed result from OpenAI', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  nativeAlternative: '很高兴见到你。',
                  register: 'neutral',
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    )
    const result = await fetchNativeAlternative({
      sourceText: 'Nice to meet you.',
      primaryTranslation: '很高兴认识你。',
      voiceRegion: 'zh-CN',
    })
    expect(result?.nativeAlternative).toBe('很高兴见到你。')
  })

  it('returns null when API fails', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('nope', { status: 500 }))
    const result = await fetchNativeAlternative({
      sourceText: 'Hi',
      primaryTranslation: '你好',
      voiceRegion: 'zh-TW',
    })
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /workspace/apps/web && npx vitest run lib/native-alternative.test.ts
```

- [ ] **Step 3: Implement `lib/native-alternative.ts`**

```typescript
import type { Register, VoiceRegion } from '@mindyourlanguage/shared'

export interface NativeAlternativeResult {
  nativeAlternative: string
  register: Register
  note?: string
}

const REGISTERS = new Set<Register>(['formal', 'casual', 'neutral'])

export function differsFromPrimary(primary: string, alternative: string): boolean {
  return primary.replace(/\s+/g, '').trim() !== alternative.replace(/\s+/g, '').trim()
}

export function registerLabel(register: Register): string {
  switch (register) {
    case 'formal':
      return '书面'
    case 'casual':
      return '口语'
    case 'neutral':
      return '中性'
  }
}

export function parseNativeAlternativeResponse(
  content: string,
): NativeAlternativeResult | null {
  try {
    const data = JSON.parse(content) as Partial<NativeAlternativeResult>
    if (
      typeof data.nativeAlternative !== 'string' ||
      !data.nativeAlternative.trim() ||
      !REGISTERS.has(data.register as Register)
    ) {
      return null
    }
    return {
      nativeAlternative: data.nativeAlternative.trim(),
      register: data.register as Register,
      ...(typeof data.note === 'string' && data.note.trim()
        ? { note: data.note.trim() }
        : {}),
    }
  } catch {
    return null
  }
}

function countChineseChars(text: string): number {
  return [...text].filter((c) => /[\u4e00-\u9fff]/.test(c)).length
}

export function shouldRequestNativeAlternative(input: {
  sourceLang: 'en' | 'zh'
  targetLang: 'en' | 'zh'
  includeNativeAlternative?: boolean
  primaryTranslation: string
}): boolean {
  if (!input.includeNativeAlternative) return false
  if (!(input.sourceLang === 'en' && input.targetLang === 'zh')) return false
  return countChineseChars(input.primaryTranslation) >= 2
}

export async function fetchNativeAlternative(input: {
  sourceText: string
  primaryTranslation: string
  voiceRegion: VoiceRegion
}): Promise<NativeAlternativeResult | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const model = process.env.NATIVE_ALT_MODEL ?? 'gpt-4o-mini'
  const regionLabel =
    input.voiceRegion === 'zh-TW' ? 'Taiwan Mandarin' : 'Mainland Mandarin'

  const system = `You help intermediate Mandarin learners sound more native.
Rewrite the machine translation so it sounds like a fluent ${regionLabel} speaker.
Return ONLY JSON: {"nativeAlternative":"...","register":"formal|casual|neutral","note":"optional short English note"}.
If the translation is already natural, return it unchanged with register "neutral".`

  const user = `English source: ${input.sourceText}
DeepL Chinese: ${input.primaryTranslation}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) return null
    return parseNativeAlternativeResponse(content)
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /workspace/apps/web && npx vitest run lib/native-alternative.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/native-alternative.ts apps/web/lib/native-alternative.test.ts
git commit -m "feat: add OpenAI native alternative helper"
```

---

### Task 9: Wire native alternative into translate route

**Files:**
- Modify: `apps/web/app/api/translate/route.ts`
- Modify: `apps/web/app/api/translate/route.test.ts`

- [ ] **Step 1: Add route tests for native path**

```typescript
vi.mock('@/lib/native-alternative', () => ({
  shouldRequestNativeAlternative: vi.fn().mockReturnValue(true),
  fetchNativeAlternative: vi.fn().mockResolvedValue({
    nativeAlternative: '嗨，幸会。',
    register: 'casual',
    note: 'more colloquial',
  }),
  differsFromPrimary: vi.fn().mockReturnValue(true),
}))
```

Cases:
1. When `includeNativeAlternative: true` and EN→ZH → response includes `nativeAlternative` + `register`
2. When `fetchNativeAlternative` returns null → still 200 without native fields
3. When ZH→EN → `fetchNativeAlternative` not called

- [ ] **Step 2: Run — expect FAIL on new assertions**

- [ ] **Step 3: Update route**

After successful DeepL + enrichment:

```typescript
import {
  differsFromPrimary,
  fetchNativeAlternative,
  shouldRequestNativeAlternative,
} from '@/lib/native-alternative'
import type { VoiceRegion } from '@mindyourlanguage/shared'

// inside POST, after building base payload fields:
let nativeFields: {
  nativeAlternative?: string
  register?: string
  nativeNote?: string
} = {}

const voiceRegion: VoiceRegion =
  body.voiceRegion === 'zh-TW' ? 'zh-TW' : 'zh-CN'

if (
  shouldRequestNativeAlternative({
    sourceLang: body.sourceLang,
    targetLang: body.targetLang,
    includeNativeAlternative: body.includeNativeAlternative,
    primaryTranslation: text,
  })
) {
  try {
    const native = await fetchNativeAlternative({
      sourceText: body.text,
      primaryTranslation: text,
      voiceRegion,
    })
    if (
      native &&
      differsFromPrimary(text, native.nativeAlternative)
    ) {
      nativeFields = {
        nativeAlternative: native.nativeAlternative,
        register: native.register,
        ...(native.note ? { nativeNote: native.note } : {}),
      }
    }
  } catch (err) {
    console.error('native alternative failed', err)
  }
}

return NextResponse.json({
  id: randomUUID(),
  translation: text,
  detectedLang: body.sourceLang,
  segments: enrichment?.segments ?? [],
  dictionaryMatches: enrichment?.dictionaryMatches ?? [],
  ...(enrichment
    ? { pinyin: enrichment.pinyin, traditional: enrichment.traditional }
    : {}),
  ...nativeFields,
})
```

- [ ] **Step 4: Run translate tests — expect PASS**

```bash
cd /workspace/apps/web && npx vitest run app/api/translate/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/translate/
git commit -m "feat: optionally attach native alternative to translate API"
```

---

### Task 10: Native alternative UI + env example

**Files:**
- Create: `apps/web/components/native-alternative-card.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/translator-form.tsx` (optional checkbox) **or** keep toggle on page
- Create: `apps/web/.env.example`

- [ ] **Step 1: Build card**

```tsx
"use client";

import type { CharacterSet, Register } from "@mindyourlanguage/shared";
import { registerLabel } from "@/lib/native-alternative";
import { toTraditionalChars } from "@/lib/characters";

// NOTE: toTraditionalChars uses opencc — if it is server-oriented today, either:
// 1) apply traditional form on the server into a new response field, or
// 2) duplicate a tiny client OpenCC call, or
// 3) pass `traditionalNativeAlternative` from server later.
// Preferred for this task: show `nativeAlternative` as returned (DeepL/OpenAI usually simplified)
// and if characterSet === 'traditional', call a small client helper.
// If importing `@/lib/characters` fails in client bundle, inline opencc-js Converter in this component.

interface NativeAlternativeCardProps {
  alternative: string;
  register: Register;
  note?: string;
  characterSet: CharacterSet;
}

export function NativeAlternativeCard({
  alternative,
  register,
  note,
  characterSet,
}: NativeAlternativeCardProps) {
  const display =
    characterSet === "traditional" ? toTraditionalChars(alternative) : alternative;

  return (
    <section aria-label="Native alternative" className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-medium text-foreground">Native alternative</h2>
        <span className="text-xs text-muted-foreground">{registerLabel(register)}</span>
      </div>
      <p className="text-lg leading-relaxed text-foreground">{display}</p>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
    </section>
  );
}
```

If `opencc-js` / `characters.ts` is not client-safe, move `registerLabel` to `packages/shared` or a tiny `lib/register-label.ts` without Node APIs, and convert traditional on the server when attaching `nativeAlternative` (add `nativeAlternativeTraditional` only if needed). Prefer extracting `registerLabel` + `differsFromPrimary` into files safe for client import.

**Concrete preference for implementers:** split helpers:

- `apps/web/lib/native-alternative-shared.ts` — `differsFromPrimary`, `registerLabel`, `parseNativeAlternativeResponse`, `shouldRequestNativeAlternative` (no fetch)
- `apps/web/lib/native-alternative.ts` — `fetchNativeAlternative` only (server)

Client imports shared helpers only.

- [ ] **Step 2: Wire page state**

In `page.tsx`:

- `const [includeNativeAlternative, setIncludeNativeAlternative] = useState(true)`
- Show a simple checkbox when `direction.sourceLang === 'en' && direction.targetLang === 'zh'`
- Pass `includeNativeAlternative` and `voiceRegion` in `TranslateRequest`
- Render:

```tsx
{result?.nativeAlternative && result.register ? (
  <NativeAlternativeCard
    alternative={result.nativeAlternative}
    register={result.register}
    note={result.nativeNote}
    characterSet={characterSet}
  />
) : null}
```

- [ ] **Step 3: Create `apps/web/.env.example`**

```
DEEPL_API_KEY=
AZURE_TTS_KEY=
AZURE_TTS_REGION=eastus
DATABASE_URL=
RATE_LIMIT_PER_MIN=20
CEDICT_DB_PATH=
OPENAI_API_KEY=
NATIVE_ALT_MODEL=gpt-4o-mini
```

- [ ] **Step 4: Run unit tests + manual EN→ZH check with `OPENAI_API_KEY`**

```bash
cd /workspace/apps/web && npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/native-alternative-card.tsx apps/web/app/page.tsx apps/web/lib/ apps/web/.env.example
git commit -m "feat: show native alternative card with register labels"
```

---

## Execution order summary

| Task | PR | Depends on |
|---|---|---|
| 1 Parser + importer | 2a | — |
| 2 lookupTerm | 2a | 1 |
| 3 segment | 2a | 2 |
| 4 `/api/dictionary` | 2a | 2 |
| 5 Translate enrichment | 2a | 3, 4 |
| 6 Grounding panel | 2a | 5 |
| 7 Shared types | 2b | 6 (or parallel after 5) |
| 8 Native alt lib | 2b | 7 |
| 9 Translate route native | 2b | 8 |
| 10 Native alt UI | 2b | 9 |

Suggested git branching: implement Tasks 1–6 on `cursor/phase-2a-dictionary-c96f`, merge; then Tasks 7–10 on `cursor/phase-2b-native-alternative-c96f`.

---

## Plan self-review

| Spec requirement | Task |
|---|---|
| CEDICT → SQLite import + fallback archive | 1 |
| `lookupTerm` / `segment` package | 2, 3 |
| `GET /api/dictionary` | 4 |
| Enrich translate `dictionaryMatches` (cap 15) + word segments | 5 |
| Grounding panel + empty state | 6 |
| EN→ZH native alt + register + non-blocking failures | 8, 9 |
| UI card + default-on toggle + env docs | 10 |
| Dual-engine / TTS / history | Explicitly out of plan |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-13-phase-2-dictionary-native-alternative.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach would you like to use?
