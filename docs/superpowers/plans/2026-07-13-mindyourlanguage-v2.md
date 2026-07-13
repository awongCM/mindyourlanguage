# Mind Your Language v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a greenfield Next.js Mandarin fluency grounding tool with bidirectional EN↔ZH translation, Simplified/Traditional toggles, CEDICT dictionary grounding, dual-region TTS, and auth-ready Postgres — deployable on Render.

**Architecture:** Monorepo (`apps/web` + `packages/dictionary` + `packages/shared`). Next.js API routes proxy DeepL and Azure TTS server-side. CC-CEDICT in SQLite for dictionary lookups. Postgres schema created in Phase 0 with nullable `userId`; MVP uses localStorage for history.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, DeepL API, Azure Neural TTS, opencc-js, pinyin-pro, PostgreSQL, Zustand, Vitest, Playwright, Render.

**Design spec:** `docs/superpowers/specs/2026-07-13-mindyourlanguage-v2-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `package.json` | npm workspaces root |
| `apps/web/package.json` | Next.js app dependencies |
| `apps/web/app/page.tsx` | Main translator page |
| `apps/web/app/layout.tsx` | Root layout, fonts, metadata |
| `apps/web/app/api/translate/route.ts` | Translation + pinyin + dictionary enrichment |
| `apps/web/app/api/dictionary/route.ts` | Standalone CEDICT lookup |
| `apps/web/app/api/speak/route.ts` | Azure TTS audio stream |
| `apps/web/components/translator-form.tsx` | Input, direction toggle, submit |
| `apps/web/components/toggles.tsx` | 简体/繁體 and CN/TW voice toggles |
| `apps/web/components/result-card.tsx` | Translation, pinyin, segments display |
| `apps/web/components/grounding-panel.tsx` | Dictionary match list |
| `apps/web/components/history-drawer.tsx` | Local history sidebar |
| `apps/web/lib/stores/history.ts` | Zustand + localStorage history store |
| `apps/web/lib/rate-limit.ts` | Per-IP rate limiting |
| `packages/shared/src/types.ts` | Shared TypeScript types |
| `packages/dictionary/src/lookup.ts` | CEDICT SQLite queries |
| `packages/dictionary/src/segment.ts` | Chinese word segmentation |
| `scripts/import-cedict.ts` | CC-CEDICT → SQLite importer |
| `db/migrations/001_initial.sql` | Postgres schema |
| `render.yaml` | Render Blueprint |

---

## Phase 0: Foundation

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `apps/web/package.json`
- Create: `packages/shared/package.json`
- Create: `packages/dictionary/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "mindyourlanguage",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev -w apps/web",
    "build": "npm run build -w apps/web",
    "test": "npm run test -w apps/web",
    "import-cedict": "npx tsx scripts/import-cedict.ts"
  }
}
```

- [ ] **Step 2: Scaffold Next.js app**

Run:
```bash
cd /workspace
npx create-next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm --no-turbopack
```

Expected: `apps/web/` created with Next.js 15 structure.

- [ ] **Step 3: Add placeholder home page**

Replace `apps/web/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Mind Your Language</h1>
      <p className="text-muted-foreground mt-2">
        From solid intermediate to natural fluency.
      </p>
    </main>
  )
}
```

- [ ] **Step 4: Verify dev server starts**

Run:
```bash
npm install
npm run dev
```

Expected: Server at `http://localhost:3000` shows placeholder page.

- [ ] **Step 5: Commit**

```bash
git add package.json apps/web packages/
git commit -m "feat: scaffold Next.js monorepo for Mind Your Language v2"
```

---

### Task 2: Shared types package

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/package.json`

- [ ] **Step 1: Write failing test**

Create `packages/shared/src/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { TranslationRecord, DictionaryEntry } from './types'

describe('TranslationRecord type', () => {
  it('accepts a valid translation record shape', () => {
    const record: TranslationRecord = {
      id: 'test-id',
      userId: null,
      sourceText: 'Hello',
      sourceLang: 'en',
      targetLang: 'zh',
      translation: '你好',
      characterSet: 'simplified',
      dictionaryMatches: [],
      segments: [],
      createdAt: new Date().toISOString(),
    }
    expect(record.sourceLang).toBe('en')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd packages/shared && npx vitest run src/types.test.ts
```

Expected: FAIL — `types.ts` not found.

- [ ] **Step 3: Implement types**

Create `packages/shared/src/types.ts`:

```typescript
export type Lang = 'en' | 'zh'
export type CharacterSet = 'simplified' | 'traditional'
export type VoiceRegion = 'zh-CN' | 'zh-TW'
export type Register = 'formal' | 'casual' | 'neutral'

export interface DictionaryEntry {
  simplified: string
  traditional: string
  pinyin: string
  definitions: string[]
}

export interface TranslationSegment {
  text: string
  pinyin: string
}

export interface TranslationRecord {
  id: string
  userId: string | null
  sourceText: string
  sourceLang: Lang
  targetLang: Lang
  translation: string
  traditional?: string
  pinyin?: string
  characterSet: CharacterSet
  register?: Register
  nativeAlternative?: string
  dictionaryMatches: DictionaryEntry[]
  segments: TranslationSegment[]
  createdAt: string
}

export interface TranslateRequest {
  text: string
  sourceLang: Lang
  targetLang: Lang
  characterSet: CharacterSet
}

export interface TranslateResponse {
  id: string
  translation: string
  traditional?: string
  pinyin?: string
  detectedLang: Lang
  segments: TranslationSegment[]
  dictionaryMatches: DictionaryEntry[]
}
```

Create `packages/shared/src/index.ts`:
```typescript
export * from './types'
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd packages/shared && npx vitest run src/types.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared TypeScript types for translation domain"
```

---

### Task 3: Postgres schema

**Files:**
- Create: `db/migrations/001_initial.sql`

- [ ] **Step 1: Write migration SQL**

Create `db/migrations/001_initial.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS translations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id),
  source_text         TEXT NOT NULL,
  source_lang         TEXT NOT NULL CHECK (source_lang IN ('en', 'zh')),
  target_lang         TEXT NOT NULL CHECK (target_lang IN ('en', 'zh')),
  translation         TEXT NOT NULL,
  traditional         TEXT,
  pinyin              TEXT,
  character_set       TEXT NOT NULL DEFAULT 'simplified',
  native_alternative  TEXT,
  register            TEXT CHECK (register IN ('formal', 'casual', 'neutral')),
  dictionary_matches  JSONB NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS phrasebook (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  translation_id  UUID REFERENCES translations(id) ON DELETE CASCADE,
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_translations_user_id ON translations(user_id);
CREATE INDEX IF NOT EXISTS idx_translations_created_at ON translations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phrasebook_user_id ON phrasebook(user_id);
```

- [ ] **Step 2: Commit**

```bash
git add db/
git commit -m "feat: add auth-ready Postgres schema for translations and phrasebook"
```

---

### Task 4: shadcn/ui + base layout

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/components/ui/` (via shadcn CLI)
- Create: `apps/web/components/toggles.tsx`

- [ ] **Step 1: Initialize shadcn/ui**

Run:
```bash
cd apps/web
npx shadcn@latest init -y
npx shadcn@latest add button textarea card sheet toast toggle-group
```

- [ ] **Step 2: Build base layout with header**

Update `apps/web/app/layout.tsx` to include a sticky header with:
- Brand: "Mind Your Language"
- Subtitle: "From solid intermediate to natural fluency"

- [ ] **Step 3: Create `toggles.tsx`**

```tsx
'use client'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { CharacterSet, VoiceRegion } from '@mindyourlanguage/shared'

interface TogglesProps {
  characterSet: CharacterSet
  onCharacterSetChange: (v: CharacterSet) => void
  voiceRegion: VoiceRegion
  onVoiceRegionChange: (v: VoiceRegion) => void
}

export function Toggles({
  characterSet, onCharacterSetChange,
  voiceRegion, onVoiceRegionChange,
}: TogglesProps) {
  return (
    <div className="flex gap-4 flex-wrap">
      <ToggleGroup type="single" value={characterSet}
        onValueChange={(v) => v && onCharacterSetChange(v as CharacterSet)}>
        <ToggleGroupItem value="simplified">简体</ToggleGroupItem>
        <ToggleGroupItem value="traditional">繁體</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup type="single" value={voiceRegion}
        onValueChange={(v) => v && onVoiceRegionChange(v as VoiceRegion)}>
        <ToggleGroupItem value="zh-CN">CN Voice</ToggleGroupItem>
        <ToggleGroupItem value="zh-TW">TW Voice</ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
```

- [ ] **Step 4: Verify layout renders toggles on home page**

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat: add shadcn/ui base layout and character/voice toggles"
```

---

## Phase 1: Core translation

### Task 5: DeepL translate API route

**Files:**
- Create: `apps/web/app/api/translate/route.ts`
- Create: `apps/web/lib/deepl.ts`
- Create: `apps/web/lib/rate-limit.ts`
- Test: `apps/web/app/api/translate/route.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { POST } from './route'

vi.mock('@/lib/deepl', () => ({
  translateText: vi.fn().mockResolvedValue({
    text: '你好',
    detectedLang: 'en',
  }),
}))

describe('POST /api/translate', () => {
  it('returns translation for valid English input', async () => {
    const req = new Request('http://localhost/api/translate', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Hello',
        sourceLang: 'en',
        targetLang: 'zh',
        characterSet: 'simplified',
      }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.translation).toBe('你好')
  })

  it('returns 400 for empty text', async () => {
    const req = new Request('http://localhost/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text: '', sourceLang: 'en', targetLang: 'zh', characterSet: 'simplified' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd apps/web && npx vitest run app/api/translate/route.test.ts`

- [ ] **Step 3: Implement `lib/deepl.ts`**

```typescript
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate'

const LANG_MAP = { en: 'EN', zh: 'ZH' } as const

export async function translateText(
  text: string,
  sourceLang: 'en' | 'zh',
  targetLang: 'en' | 'zh',
): Promise<{ text: string; detectedLang: 'en' | 'zh' }> {
  const params = new URLSearchParams({
    text,
    source_lang: LANG_MAP[sourceLang],
    target_lang: LANG_MAP[targetLang],
  })
  const res = await fetch(DEEPL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  if (!res.ok) throw new Error(`DeepL error: ${res.status}`)
  const data = await res.json()
  return {
    text: data.translations[0].text,
    detectedLang: sourceLang,
  }
}
```

- [ ] **Step 4: Implement `app/api/translate/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { translateText } from '@/lib/deepl'
import { checkRateLimit } from '@/lib/rate-limit'
import type { TranslateRequest } from '@mindyourlanguage/shared'
import { randomUUID } from 'crypto'

const MAX_CHARS = 500

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body: TranslateRequest = await req.json()
  if (!body.text?.trim()) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }
  if (body.text.length > MAX_CHARS) {
    return NextResponse.json({ error: `Text exceeds ${MAX_CHARS} characters` }, { status: 400 })
  }

  try {
    const { text } = await translateText(body.text, body.sourceLang, body.targetLang)
    return NextResponse.json({
      id: randomUUID(),
      translation: text,
      detectedLang: body.sourceLang,
      segments: [],
      dictionaryMatches: [],
    })
  } catch {
    return NextResponse.json({ error: 'Translation service unavailable' }, { status: 502 })
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/ apps/web/lib/
git commit -m "feat: add DeepL translate API route with rate limiting"
```

---

### Task 6: Pinyin + character conversion enrichment

**Files:**
- Create: `apps/web/lib/pinyin.ts`
- Create: `apps/web/lib/characters.ts`
- Modify: `apps/web/app/api/translate/route.ts`
- Test: `apps/web/lib/pinyin.test.ts`

- [ ] **Step 1: Install dependencies**

```bash
cd apps/web && npm install pinyin-pro opencc-js
```

- [ ] **Step 2: Write failing pinyin test**

```typescript
import { describe, it, expect } from 'vitest'
import { toPinyin, segmentChinese } from './pinyin'

describe('toPinyin', () => {
  it('returns tone-marked pinyin for Chinese text', () => {
    expect(toPinyin('你好')).toMatch(/nǐ hǎo/)
  })
})

describe('segmentChinese', () => {
  it('segments Chinese text into words', () => {
    const segments = segmentChinese('你好世界')
    expect(segments.length).toBeGreaterThan(0)
    expect(segments[0]).toHaveProperty('text')
    expect(segments[0]).toHaveProperty('pinyin')
  })
})
```

- [ ] **Step 3: Implement `lib/pinyin.ts`**

```typescript
import { pinyin } from 'pinyin-pro'

export function toPinyin(text: string): string {
  return pinyin(text, { toneType: 'symbol', type: 'array' }).join(' ')
}

export function segmentChinese(text: string): { text: string; pinyin: string }[] {
  const chars = [...text]
  return chars
    .filter((c) => /[\u4e00-\u9fff]/.test(c))
    .map((c) => ({ text: c, pinyin: pinyin(c, { toneType: 'symbol' }) }))
}
```

- [ ] **Step 4: Implement `lib/characters.ts`**

```typescript
import { Converter } from 'opencc-js'

const toTraditional = Converter({ from: 'cn', to: 'tw' })
const toSimplified = Converter({ from: 'tw', to: 'cn' })

export function toTraditionalChars(text: string): string {
  return toTraditional(text)
}

export function toSimplifiedChars(text: string): string {
  return toSimplified(text)
}
```

- [ ] **Step 5: Enrich translate route** — when `targetLang === 'zh'`, add `pinyin`, `traditional`, `segments` to response.

- [ ] **Step 6: Run tests — expect PASS**

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/ apps/web/app/api/translate/
git commit -m "feat: add pinyin segmentation and simplified/traditional conversion"
```

---

### Task 7: Translator UI

**Files:**
- Create: `apps/web/components/translator-form.tsx`
- Create: `apps/web/components/result-card.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Build `translator-form.tsx`**

Props: `onSubmit`, `isLoading`, `direction`, `onDirectionChange`.  
Includes: textarea (max 500 chars with counter), EN↔ZH direction toggle, Translate button with spinner.

- [ ] **Step 2: Build `result-card.tsx`**

Displays: `translation`, `pinyin`, `traditional` (respects character set toggle), segmented words, Play buttons (wired in Task 9).

- [ ] **Step 3: Wire `page.tsx`**

Client component orchestrating: toggles state, form submit → `fetch('/api/translate')` → result card.

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`, translate "Hello, nice to meet you." EN→ZH.  
Expected: Chinese translation with pinyin and traditional form visible on toggle.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ apps/web/app/page.tsx
git commit -m "feat: add translator form and result card UI"
```

---

## Phase 2: Dictionary grounding

### Task 8: CC-CEDICT import + lookup

**Files:**
- Create: `scripts/import-cedict.ts`
- Create: `packages/dictionary/src/lookup.ts`
- Create: `packages/dictionary/src/segment.ts`
- Create: `apps/web/app/api/dictionary/route.ts`
- Test: `packages/dictionary/src/lookup.test.ts`

- [ ] **Step 1: Download CC-CEDICT**

```bash
curl -o data/cedict.txt https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt
```

- [ ] **Step 2: Write CEDICT importer `scripts/import-cedict.ts`**

Parses CC-CEDICT format:
```
Traditional Simplified [pinyin] /definition1/definition2/
```
Outputs SQLite `data/cedict.db` with table:
```sql
CREATE TABLE entries (
  traditional TEXT, simplified TEXT, pinyin TEXT, definitions TEXT
);
CREATE INDEX idx_simplified ON entries(simplified);
CREATE INDEX idx_traditional ON entries(traditional);
```

- [ ] **Step 3: Write failing lookup test**

```typescript
import { describe, it, expect } from 'vitest'
import { lookupTerm } from './lookup'

describe('lookupTerm', () => {
  it('finds dictionary entry for 认识', async () => {
    const entries = await lookupTerm('认识')
    expect(entries.length).toBeGreaterThan(0)
    expect(entries[0].simplified).toBe('认识')
    expect(entries[0].definitions.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 4: Implement `lookup.ts`** using `better-sqlite3`

- [ ] **Step 5: Run import + tests**

```bash
npm run import-cedict
cd packages/dictionary && npx vitest run src/lookup.test.ts
```

Expected: PASS

- [ ] **Step 6: Create `GET /api/dictionary` route**

- [ ] **Step 7: Enrich translate route** — after translation, segment Chinese text and call `lookupTerm` for each segment; attach `dictionaryMatches` to response.

- [ ] **Step 8: Commit**

```bash
git add scripts/ packages/dictionary/ apps/web/app/api/dictionary/ data/.gitkeep
git commit -m "feat: add CC-CEDICT dictionary import and lookup API"
```

---

### Task 9: Grounding panel UI

**Files:**
- Create: `apps/web/components/grounding-panel.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Build `grounding-panel.tsx`**

Shows list of `DictionaryEntry` items: simplified, traditional, pinyin, definitions.  
Collapsible section below result card.  
Empty state: "No dictionary matches for this translation."

- [ ] **Step 2: Wire to translate response `dictionaryMatches`**

- [ ] **Step 3: Manual test** — translate a sentence containing 认识, verify grounding panel shows entry.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/grounding-panel.tsx apps/web/app/page.tsx
git commit -m "feat: add dictionary grounding panel to translator UI"
```

---

## Phase 3: TTS + History

### Task 10: Azure TTS API route

**Files:**
- Create: `apps/web/app/api/speak/route.ts`
- Create: `apps/web/lib/tts.ts`
- Test: `apps/web/lib/tts.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { buildTtsUrl } from './tts'

describe('buildTtsUrl', () => {
  it('selects zh-CN voice for mainland', () => {
    const url = buildTtsUrl('你好', 'zh-CN')
    expect(url).toContain('zh-CN-XiaoxiaoNeural')
  })
  it('selects zh-TW voice for taiwan', () => {
    const url = buildTtsUrl('你好', 'zh-TW')
    expect(url).toContain('zh-TW-HsiaoChenNeural')
  })
})
```

- [ ] **Step 2: Implement `lib/tts.ts`**

```typescript
import type { VoiceRegion } from '@mindyourlanguage/shared'

const VOICES: Record<VoiceRegion, string> = {
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'zh-TW': 'zh-TW-HsiaoChenNeural',
}

export function buildTtsUrl(text: string, voice: VoiceRegion): string {
  const region = process.env.AZURE_TTS_REGION ?? 'eastus'
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`
}

export async function synthesizeSpeech(
  text: string,
  voice: VoiceRegion,
): Promise<ArrayBuffer> {
  const res = await fetch(buildTtsUrl(text, voice), {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_TTS_KEY!,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
    },
    body: `<speak version='1.0' xml:lang='${voice}'>
      <voice xml:lang='${voice}' name='${VOICES[voice]}'>${text}</voice>
    </speak>`,
  })
  if (!res.ok) throw new Error(`TTS error: ${res.status}`)
  return res.arrayBuffer()
}
```

- [ ] **Step 3: Implement `POST /api/speak`** — returns `audio/mpeg` stream.

- [ ] **Step 4: Wire Play buttons in `result-card.tsx`**

On click: `fetch('/api/speak', { method: 'POST', body: JSON.stringify({ text, voice }) })` → play via `Audio` API.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/speak/ apps/web/lib/tts.ts apps/web/components/result-card.tsx
git commit -m "feat: add Azure Neural TTS with CN and TW voice support"
```

---

### Task 11: Local history store + drawer

**Files:**
- Create: `apps/web/lib/stores/history.ts`
- Create: `apps/web/components/history-drawer.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Implement Zustand history store**

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TranslationRecord } from '@mindyourlanguage/shared'

interface HistoryStore {
  items: TranslationRecord[]
  add: (record: TranslationRecord) => void
  remove: (id: string) => void
  clear: () => void
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      items: [],
      add: (record) => set((s) => ({
        items: [record, ...s.items].slice(0, 50),
      })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'myl-history' },
  ),
)
```

- [ ] **Step 2: Build `history-drawer.tsx`** using shadcn Sheet component.

- [ ] **Step 3: Wire save on successful translation + restore on history item click**

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/stores/ apps/web/components/history-drawer.tsx
git commit -m "feat: add local translation history with Zustand persistence"
```

---

## Phase 4: Deploy + E2E

### Task 12: Render Blueprint

**Files:**
- Create: `render.yaml`
- Create: `apps/web/.env.example`

- [ ] **Step 1: Write `render.yaml`**

```yaml
services:
  - type: web
    name: mindyourlanguage
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm run start -w apps/web
    envVars:
      - key: DEEPL_API_KEY
        sync: false
      - key: AZURE_TTS_KEY
        sync: false
      - key: AZURE_TTS_REGION
        value: eastus
      - key: DATABASE_URL
        fromDatabase:
          name: mindyourlanguage-db
          property: connectionString
      - key: NODE_ENV
        value: production

databases:
  - name: mindyourlanguage-db
    plan: free
```

- [ ] **Step 2: Create `.env.example`**

- [ ] **Step 3: Commit**

```bash
git add render.yaml apps/web/.env.example
git commit -m "feat: add Render Blueprint and environment variable template"
```

---

### Task 13: Playwright E2E tests

**Files:**
- Create: `apps/web/e2e/translate.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
cd apps/web && npm install -D @playwright/test && npx playwright install chromium
```

- [ ] **Step 2: Write E2E test**

```typescript
import { test, expect } from '@playwright/test'

test('translate English to Chinese', async ({ page }) => {
  await page.goto('/')
  await page.fill('textarea', 'Hello, nice to meet you.')
  await page.click('button:has-text("Translate")')
  await expect(page.locator('[data-testid="result-translation"]')).not.toBeEmpty({ timeout: 10000 })
})

test('toggle traditional characters', async ({ page }) => {
  await page.goto('/')
  await page.click('button:has-text("繁體")')
  await expect(page.locator('button:has-text("繁體")')).toHaveAttribute('data-state', 'on')
})
```

- [ ] **Step 3: Run E2E**

```bash
cd apps/web && npx playwright test
```

Expected: PASS (with valid API keys in `.env.local`)

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/
git commit -m "test: add Playwright E2E tests for translate flow and toggles"
```

---

## Phase 5: Public readiness (post-MVP)

### Task 14: OAuth + cloud sync (when ready for public)

**Files:**
- Create: `apps/web/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/lib/db.ts`
- Modify: `apps/web/lib/stores/history.ts`

- [ ] **Step 1:** Add NextAuth.js with Google provider
- [ ] **Step 2:** Migrate history store to sync with Postgres when `userId` present
- [ ] **Step 3:** Add login button to header (hidden until public launch flag enabled)

---

### Task 15: Native alternative (Phase 2 feature)

**Files:**
- Create: `apps/web/lib/native-alternative.ts`
- Modify: `apps/web/app/api/translate/route.ts`
- Create: `apps/web/components/native-alternative-card.tsx`

- [ ] **Step 1:** Add LLM call (OpenAI or Anthropic) with prompt: "Rewrite this translation to sound like a fluent {CN|TW} Mandarin speaker. Explain register."
- [ ] **Step 2:** Display native alternative below primary translation when different
- [ ] **Step 3:** Add register label (口语/书面/neutral)

---

## Execution order summary

| Task | Phase | Depends on |
|---|---|---|
| 1 Monorepo scaffold | 0 | — |
| 2 Shared types | 0 | 1 |
| 3 Postgres schema | 0 | — |
| 4 shadcn + layout | 0 | 1 |
| 5 Translate API | 1 | 2, 4 |
| 6 Pinyin + chars | 1 | 5 |
| 7 Translator UI | 1 | 5, 6 |
| 8 CEDICT lookup | 2 | 2 |
| 9 Grounding panel | 2 | 7, 8 |
| 10 TTS | 3 | 7 |
| 11 History | 3 | 7 |
| 12 Render deploy | 4 | 1–11 |
| 13 E2E tests | 4 | 7, 9, 10 |
| 14 OAuth | 5 | 12 |
| 15 Native alternative | 5 | 9 |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-13-mindyourlanguage-v2.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach would you like to use?
