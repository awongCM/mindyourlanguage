# Phase 4 Render Deploy + Playwright E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 4 for personal MVP — deploy Mind Your Language to Render via Blueprint (with CEDICT build import + health checks) and add a mocked Playwright E2E suite that needs no paid API keys by default.

**Architecture:** Root `render.yaml` defines a Node web service + Postgres. Build runs `npm ci && npm run import-cedict && npm run build`; start binds `0.0.0.0:$PORT`. `GET /api/health` gates readiness on CEDICT + DeepL config. Playwright Chromium specs mock `/api/translate` for CI-stable coverage of translate UI, toggles, history, phrasebook, and play controls. OAuth and cloud sync stay Phase 5.

**Tech Stack:** Render Blueprints, Next.js 16 App Router, better-sqlite3 (CEDICT), Vitest, Playwright.

**Design spec:** `docs/superpowers/specs/2026-07-15-phase-4-deploy-e2e-design.md`

## Global Constraints

- Bind HTTP to `0.0.0.0:$PORT` (Render port binding).
- No Azure / Google TTS server routes or required TTS env keys (Phase 3 Web Speech remains).
- Default E2E must pass without `DEEPL_API_KEY` / `OPENAI_API_KEY`.
- Do not implement OAuth, `/api/history`, or `/api/speak` in this phase.
- CEDICT DB stays gitignored; produce it at build time via `npm run import-cedict`.

---

## File map

| File | Responsibility |
|---|---|
| `render.yaml` | Web + Postgres Blueprint |
| `apps/web/app/api/health/route.ts` | Readiness endpoint |
| `apps/web/app/api/health/route.test.ts` | Health unit tests |
| `package.json` | Root `start` script for Render clarity |
| `apps/web/.env.example` | Align secrets with Phase 4 |
| `README.md` | Deploy + status docs |
| `apps/web/playwright.config.ts` | Playwright runner config |
| `apps/web/e2e/fixtures/translate-response.json` | Mock translate payload |
| `apps/web/e2e/helpers/mock-translate.ts` | Route mocking helper |
| `apps/web/e2e/translate.spec.ts` | Translate + toggle specs |
| `apps/web/e2e/history-phrasebook.spec.ts` | History + phrasebook specs |
| `apps/web/package.json` | Playwright dep + `test:e2e` |

---

## PR 4a — Deploy readiness

### Task 1: Health route + tests

**Files:**
- Create: `apps/web/app/api/health/route.ts`
- Create: `apps/web/app/api/health/route.test.ts`

**Interfaces:**
- Consumes: `getDictionaryDb` from `@mindyourlanguage/dictionary` (returns DB or `null`)
- Produces: `GET` handler → `{ ok, cedict, deeplConfigured }` with 200 when `ok`, else 503

- [ ] **Step 1: Write failing tests**

Create `apps/web/app/api/health/route.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@mindyourlanguage/dictionary', () => ({
  getDictionaryDb: vi.fn(),
}))

import { GET } from './route'
import { getDictionaryDb } from '@mindyourlanguage/dictionary'

describe('GET /api/health', () => {
  const originalKey = process.env.DEEPL_API_KEY

  beforeEach(() => {
    vi.mocked(getDictionaryDb).mockReset()
    process.env.DEEPL_API_KEY = 'test-key'
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.DEEPL_API_KEY
    } else {
      process.env.DEEPL_API_KEY = originalKey
    }
  })

  it('returns 200 when CEDICT and DeepL are ready', async () => {
    vi.mocked(getDictionaryDb).mockReturnValue({} as never)
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      cedict: true,
      deeplConfigured: true,
    })
  })

  it('returns 503 when CEDICT missing', async () => {
    vi.mocked(getDictionaryDb).mockReturnValue(null)
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.cedict).toBe(false)
    expect(body.deeplConfigured).toBe(true)
  })

  it('returns 503 when DeepL key missing', async () => {
    vi.mocked(getDictionaryDb).mockReturnValue({} as never)
    delete process.env.DEEPL_API_KEY
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.deeplConfigured).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /workspace/apps/web && npx vitest run app/api/health/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getDictionaryDb } from '@mindyourlanguage/dictionary'

export async function GET() {
  const cedict = getDictionaryDb() !== null
  const deeplConfigured = Boolean(process.env.DEEPL_API_KEY?.trim())
  const ok = cedict && deeplConfigured

  return NextResponse.json(
    { ok, cedict, deeplConfigured },
    { status: ok ? 200 : 503 },
  )
}
```

Confirm `getDictionaryDb` is exported from `@mindyourlanguage/dictionary` (`packages/dictionary/src/index.ts`). If not exported, add the export in this task before tests pass.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /workspace/apps/web && npx vitest run app/api/health/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/health/route.ts apps/web/app/api/health/route.test.ts packages/dictionary/src/index.ts
git commit -m "feat: add /api/health readiness check for Render"
```

---

### Task 2: Render Blueprint + start script + env docs

**Files:**
- Create: `render.yaml`
- Modify: `package.json`
- Modify: `apps/web/.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: existing `import-cedict`, `build`, `apps/web` `start` scripts
- Produces: Render-ready Blueprint; root `start` script that binds host/port

- [ ] **Step 1: Add root start helper**

In root `package.json` scripts, add:

```json
"start": "npm run start -w apps/web -- -H 0.0.0.0 -p ${PORT:-3000}"
```

Keep existing `dev`, `build`, `import-cedict`, `test`.

- [ ] **Step 2: Write `render.yaml`**

```yaml
databases:
  - name: mindyourlanguage-db
    plan: free
    region: oregon

services:
  - type: web
    name: mindyourlanguage
    runtime: node
    region: oregon
    plan: free
    buildCommand: npm ci && npm run import-cedict && npm run build
    startCommand: npm run start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DEEPL_API_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: NATIVE_ALT_MODEL
        value: gpt-4o-mini
      - key: RATE_LIMIT_PER_MIN
        value: "20"
      - key: DATABASE_URL
        fromDatabase:
          name: mindyourlanguage-db
          property: connectionString
```

Do **not** include `AZURE_TTS_KEY` / `AZURE_TTS_REGION`.

If `plan: free` is rejected by current Render schema validation, switch DB/web plans to the smallest paid/basic equivalents documented in Render Blueprint docs and note the change in the commit message.

- [ ] **Step 3: Align `.env.example`**

Replace `apps/web/.env.example` with:

```bash
DEEPL_API_KEY=
DATABASE_URL=
RATE_LIMIT_PER_MIN=20
CEDICT_DB_PATH=
OPENAI_API_KEY=
NATIVE_ALT_MODEL=gpt-4o-mini

# Phase 3+ TTS uses the browser Web Speech API (no server key).
# Optional later: Google Cloud TTS
# GOOGLE_APPLICATION_CREDENTIALS=

# Optional: hide phrasebook UI later without migrations
# NEXT_PUBLIC_ENABLE_PHRASEBOOK=true
```

- [ ] **Step 4: Update README deploy/status section**

In `README.md`:

1. Change status from “Phase 0 in progress” / “v2 in planning” to reflect Phases 0–3 shipped and Phase 4 design/plan ready.
2. Add links:
   - Design: `docs/superpowers/specs/2026-07-15-phase-4-deploy-e2e-design.md`
   - Plan: `docs/superpowers/plans/2026-07-15-phase-4-deploy-e2e.md`
3. Add a **Deploy (Render)** subsection covering:
   - Blueprint sync from `render.yaml`
   - Required secret: `DEEPL_API_KEY`
   - Optional: `OPENAI_API_KEY`
   - Build imports CEDICT from repo fallback text
   - One-time: apply `db/migrations/001_initial.sql` to Render Postgres
   - Free web spin-down (~15 min) and Free Postgres expiry (~30 days)
   - Health URL: `/api/health`

- [ ] **Step 5: Validate Blueprint if CLI available**

```bash
command -v render >/dev/null && render blueprints validate || echo "Render CLI not installed; skip validate"
```

- [ ] **Step 6: Local smoke for health + import**

```bash
cd /workspace && npm run import-cedict && DEEPL_API_KEY=dummy npm run build
# In another shell after starting: curl -s localhost:3000/api/health
```

At minimum, unit tests from Task 1 still pass:

```bash
cd /workspace/apps/web && npm test
```

- [ ] **Step 7: Commit**

```bash
git add render.yaml package.json apps/web/.env.example README.md
git commit -m "feat: add Render Blueprint and deploy documentation"
```

---

## PR 4b — Playwright E2E

### Task 3: Playwright install + config

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/fixtures/translate-response.json`
- Create: `apps/web/e2e/helpers/mock-translate.ts`

**Interfaces:**
- Consumes: Next.js `npm run dev -w apps/web` on port 3000
- Produces: `npm run test:e2e -w apps/web` runs Chromium suite

- [ ] **Step 1: Install Playwright**

```bash
cd /workspace && npm install -D @playwright/test -w apps/web
cd /workspace/apps/web && npx playwright install chromium
```

Add script to `apps/web/package.json`:

```json
"test:e2e": "playwright test"
```

Optionally add root script:

```json
"test:e2e": "npm run test:e2e -w apps/web"
```

- [ ] **Step 2: Write config**

`apps/web/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -w apps/web',
    cwd: '../..',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

If workspace `cwd` resolution is awkward from `apps/web`, set `command` to `npm run dev` with `cwd` pointing at repo root absolute path pattern used in-repo.

- [ ] **Step 3: Fixture + mock helper**

`apps/web/e2e/fixtures/translate-response.json`:

```json
{
  "id": "e2e-translate-1",
  "translation": "你好，很高兴认识你。",
  "traditional": "你好，很高興認識你。",
  "pinyin": "nǐ hǎo , hěn gāo xìng rèn shi nǐ .",
  "detectedLang": "en",
  "segments": [
    { "text": "你好", "pinyin": "nǐ hǎo" },
    { "text": "很", "pinyin": "hěn" },
    { "text": "高兴", "pinyin": "gāo xìng" },
    { "text": "认识", "pinyin": "rèn shi" },
    { "text": "你", "pinyin": "nǐ" }
  ],
  "dictionaryMatches": [
    {
      "simplified": "认识",
      "traditional": "認識",
      "pinyin": "ren4 shi5",
      "definitions": ["to know (a person)"]
    }
  ],
  "nativeAlternative": "你好，幸会。",
  "register": "formal",
  "nativeNote": "More concise greeting."
}
```

`apps/web/e2e/helpers/mock-translate.ts`:

```typescript
import type { Page } from '@playwright/test'
import fixture from '../fixtures/translate-response.json'

export async function mockTranslateApi(page: Page) {
  await page.route('**/api/translate', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    })
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/playwright.config.ts apps/web/e2e/fixtures/translate-response.json apps/web/e2e/helpers/mock-translate.ts
git commit -m "chore: add Playwright config and translate mock fixture"
```

---

### Task 4: E2E specs — translate, toggles, history, phrasebook

**Files:**
- Create: `apps/web/e2e/translate.spec.ts`
- Create: `apps/web/e2e/history-phrasebook.spec.ts`

**Interfaces:**
- Consumes: `mockTranslateApi`, UI copy (`Translate`, `History`, `Phrasebook`, `Play Mainland`, `简体`/`繁體`)
- Produces: Green `npm run test:e2e -w apps/web` without API keys

- [ ] **Step 1: Write `translate.spec.ts`**

```typescript
import { expect, test } from '@playwright/test'
import { mockTranslateApi } from './helpers/mock-translate'

test.describe('translate flow (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')
  })

  test('translates English and shows result + play controls', async ({ page }) => {
    await page.getByPlaceholder('Enter text to translate…').fill('Hello, nice to meet you.')
    await page.getByRole('button', { name: 'Translate' }).click()

    await expect(page.getByTestId('result-translation')).toHaveText('你好，很高兴认识你。')
    await expect(page.getByRole('button', { name: 'Play Mainland' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Play Taiwan' })).toBeEnabled()
    await expect(page.getByText('to know (a person)')).toBeVisible()
  })

  test('toggles traditional characters', async ({ page }) => {
    await page.getByPlaceholder('Enter text to translate…').fill('Hello, nice to meet you.')
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toHaveText('你好，很高兴认识你。')

    await page.getByRole('radio', { name: '繁體' }).click()
    await expect(page.getByTestId('result-translation')).toHaveText('你好，很高興認識你。')
  })
})
```

Adjust selectors if ToggleGroup exposes buttons instead of radios — use whatever role Playwright discovers (`getByRole('button', { name: '繁體' })` is fine).

- [ ] **Step 2: Write `history-phrasebook.spec.ts`**

```typescript
import { expect, test } from '@playwright/test'
import { mockTranslateApi } from './helpers/mock-translate'

test.describe('history and phrasebook (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')
    await page.getByPlaceholder('Enter text to translate…').fill('Hello, nice to meet you.')
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
  })

  test('saves to history and restores', async ({ page }) => {
    await page.getByRole('button', { name: 'History' }).click()
    await expect(page.getByText('Hello, nice to meet you.')).toBeVisible()
    await page.getByText('你好，很高兴认识你。').first().click()
    await expect(page.getByTestId('result-translation')).toHaveText('你好，很高兴认识你。')
    await expect(page.getByPlaceholder('Enter text to translate…')).toHaveValue(
      'Hello, nice to meet you.',
    )
  })

  test('saves to phrasebook and lists entry', async ({ page }) => {
    await page.getByRole('button', { name: 'Save to phrasebook' }).click()
    await page.getByRole('button', { name: 'Phrasebook' }).click()
    await expect(page.getByText('Hello, nice to meet you.')).toBeVisible()
    await expect(page.getByText('你好，很高兴认识你。').first()).toBeVisible()
  })
})
```

- [ ] **Step 3: Run E2E — expect PASS**

```bash
cd /workspace && npm run test:e2e -w apps/web
```

Expected: all mocked tests PASS. No `DEEPL_API_KEY` required.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/translate.spec.ts apps/web/e2e/history-phrasebook.spec.ts
git commit -m "test: add Playwright E2E for translate, history, and phrasebook"
```

---

## Execution order summary

| Task | PR | Depends on |
|---|---|---|
| 1 Health route | 4a | — |
| 2 Blueprint + docs | 4a | 1 (health path referenced) |
| 3 Playwright config | 4b | — (parallel with 4a OK after merge base) |
| 4 E2E specs | 4b | 3 |

Suggested branching: `cursor/phase-4a-deploy-8d74` → `cursor/phase-4b-e2e-8d74`.

---

## Plan self-review

| Spec requirement | Task |
|---|---|
| `render.yaml` web + Postgres, no Azure keys | 2 |
| Build imports CEDICT; start on `0.0.0.0:$PORT` | 2 |
| `/api/health` CEDICT + DeepL readiness | 1 |
| README secrets + Free-tier + migration notes | 2 |
| Playwright mocked translate/toggle/history/phrasebook/play | 3, 4 |
| Default E2E without paid keys | 3, 4 |
| No OAuth / `/api/speak` / cloud history | Explicitly out of tasks |

Placeholder scan: none intentional. Live `@live` smoke is optional and omitted from required tasks to keep YAGNI; can be added later if needed.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-15-phase-4-deploy-e2e.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute in-session with executing-plans checkpoints

After design approval, which approach should we use?
