# Phase 6 Public Readiness (Neon) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 6 — Google OAuth, Neon-backed sync for history + phrasebook + SRS + review events, per-user rate limits, and Render Blueprint cleanup — while keeping logged-out translate/dictionary unchanged.

**Architecture:** Render hosts the Next.js app only. `DATABASE_URL` points at Neon (direct URL, `sslmode=require`). `pg` pool in `lib/db.ts` powers auth-gated `GET|PUT` sync routes. Zustand stores stay the UI source of truth; a client `syncAfterLogin` pushes local rows then pulls server state. NextAuth (Auth.js v5) maps Google accounts to `users` rows. Migrations `001` + `002` applied manually against Neon (not at build time).

**Tech Stack:** Next.js 16 App Router, Auth.js v5 (`next-auth`), `pg`, Vitest, Playwright, Neon Postgres, Render Blueprint.

**Design spec:** `docs/superpowers/specs/2026-07-19-phase-6-public-readiness-design.md`

## Global Constraints

- Bind HTTP to `0.0.0.0:$PORT` on Render (unchanged).
- **Invariant:** `/api/translate`, `/api/dictionary`, `/api/health` must work with `DATABASE_URL` unset or Neon unreachable.
- Use Neon **direct** connection string (no `-pooler` hostname); `sslmode=require`.
- Do not run SQL migrations during Render `buildCommand`.
- Remove Render Postgres from `render.yaml` (`databases:` block and `fromDatabase` for `DATABASE_URL`).
- Sync APIs return `401` without session, `429` when rate limited, `503` only when DB configured but query fails (with JSON error body).
- Default Vitest/Playwright suites must pass **without** Neon, Google OAuth, or `DATABASE_URL` (mock auth/DB in unit tests).
- History server cap: **50** rows per user (match `HISTORY_MAX` in `apps/web/lib/stores/history.ts`).
- Conflict resolution: **last-write-wins by row `id`** (client sends full rows on PUT).
- STT for try-first is **optional** (PR 6g); do not block PRs 6a–6f on it.

---

## File map

| File | Responsibility |
|---|---|
| `db/migrations/002_cloud_sync.sql` | Extend schema for sync |
| `render.yaml` | Web service only; manual `DATABASE_URL` note |
| `README.md` | Neon + migration + Render secret steps |
| `apps/web/.env.example` | Auth + Neon env vars |
| `apps/web/package.json` | `next-auth`, `pg`, `@types/pg` |
| `apps/web/lib/db.ts` | Pool singleton, `getPool()`, `isDatabaseConfigured()` |
| `apps/web/lib/db/users.ts` | `ensureUserByEmail(email)` → `users.id` |
| `apps/web/lib/db/mappers.ts` | Row ↔ `@mindyourlanguage/shared` types |
| `apps/web/lib/db/mappers.test.ts` | Mapper unit tests |
| `apps/web/lib/db/history.ts` | `listHistory`, `upsertHistory` |
| `apps/web/lib/db/phrasebook.ts` | `listPhrasebook`, `upsertPhrasebook` |
| `apps/web/lib/db/review-events.ts` | `listReviewEvents`, `appendReviewEvents` |
| `apps/web/lib/auth.ts` | NextAuth config export |
| `apps/web/lib/auth-session.ts` | `requireUserId()` for route handlers |
| `apps/web/app/api/auth/[...nextauth]/route.ts` | Auth.js handlers |
| `apps/web/app/api/history/route.ts` | GET + PUT history |
| `apps/web/app/api/history/route.test.ts` | History API tests |
| `apps/web/app/api/phrasebook/route.ts` | GET + PUT phrasebook |
| `apps/web/app/api/phrasebook/route.test.ts` | Phrasebook API tests |
| `apps/web/app/api/review-events/route.ts` | GET + POST review events |
| `apps/web/app/api/review-events/route.test.ts` | Review events API tests |
| `apps/web/lib/rate-limit.ts` | Extend with `checkRateLimitForKey(key)` |
| `apps/web/lib/rate-limit.test.ts` | Key-based limit tests |
| `apps/web/lib/sync/cloud-sync.ts` | Client push/pull orchestration |
| `apps/web/lib/sync/cloud-sync.test.ts` | Merge logic tests (pure functions) |
| `apps/web/components/auth-header-actions.tsx` | Sign in / out + sync trigger |
| `apps/web/components/onboarding-sync-hint.tsx` | One-step post-login hint |
| `apps/web/app/layout.tsx` | Mount auth header actions |
| `apps/web/app/api/translate/route.ts` | Use user id rate limit when session present |
| `apps/web/app/api/practice/check/route.ts` | Same per-user rate limit |
| `apps/web/e2e/sync-auth.spec.ts` | Mocked OAuth + sync smoke (optional env) |

---

## API choice (locked)

Use **three resource routes** (not a combined `/api/sync`):

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/api/history` | — | `{ items: TranslationRecord[] }` |
| `PUT` | `/api/history` | `{ items: TranslationRecord[] }` | `{ items: TranslationRecord[] }` |
| `GET` | `/api/phrasebook` | — | `{ items: PhrasebookEntry[] }` |
| `PUT` | `/api/phrasebook` | `{ items: PhrasebookEntry[] }` | `{ items: PhrasebookEntry[] }` |
| `GET` | `/api/review-events` | — | `{ events: ReviewEvent[] }` |
| `POST` | `/api/review-events` | `{ events: ReviewEvent[] }` | `{ events: ReviewEvent[] }` |

All require Auth.js session with internal `userId` (Postgres `users.id` UUID string).

---

## PR 6a — Schema + infra + DB layer

### Task 1: Migration `002_cloud_sync.sql`

**Files:**
- Create: `db/migrations/002_cloud_sync.sql`

**Interfaces:**
- Produces: SQL applied after `001_initial.sql` on Neon

- [ ] **Step 1: Add migration file**

Create `db/migrations/002_cloud_sync.sql`:

```sql
-- Phase 6: align Postgres with client stores (history, phrasebook, review events).

ALTER TABLE translations
  ADD COLUMN IF NOT EXISTS segments JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS native_note TEXT;

ALTER TABLE phrasebook
  ADD COLUMN IF NOT EXISTS source_text TEXT,
  ADD COLUMN IF NOT EXISTS source_lang TEXT CHECK (source_lang IN ('en', 'zh')),
  ADD COLUMN IF NOT EXISTS target_lang TEXT CHECK (target_lang IN ('en', 'zh')),
  ADD COLUMN IF NOT EXISTS translation TEXT,
  ADD COLUMN IF NOT EXISTS traditional TEXT,
  ADD COLUMN IF NOT EXISTS pinyin TEXT,
  ADD COLUMN IF NOT EXISTS character_set TEXT NOT NULL DEFAULT 'simplified',
  ADD COLUMN IF NOT EXISTS register TEXT CHECK (register IN ('formal', 'casual', 'neutral')),
  ADD COLUMN IF NOT EXISTS native_alternative TEXT,
  ADD COLUMN IF NOT EXISTS native_note TEXT,
  ADD COLUMN IF NOT EXISTS dictionary_matches JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS segments JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS practice_stats JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS review_events (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phrase_id       UUID NOT NULL,
  grade           TEXT NOT NULL CHECK (grade IN ('again', 'hard', 'good', 'easy')),
  reviewed_at     TIMESTAMPTZ NOT NULL,
  mode            TEXT NOT NULL DEFAULT 'self_grade',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_events_user_id ON review_events(user_id);
CREATE INDEX IF NOT EXISTS idx_review_events_user_reviewed ON review_events(user_id, reviewed_at DESC);
```

- [ ] **Step 2: Apply locally (when Neon URL available)**

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial.sql
psql "$DATABASE_URL" -f db/migrations/002_cloud_sync.sql
```

Expected: `CREATE TABLE` / `ALTER TABLE` succeed; `\dt` shows `review_events`.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/002_cloud_sync.sql
git commit -m "feat: add Phase 6 cloud sync Postgres migration"
```

---

### Task 2: Render Blueprint + deploy docs

**Files:**
- Modify: `render.yaml`
- Modify: `README.md` (Deploy section)
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Update `render.yaml`**

Remove lines 1–4 (`databases:` block). Replace `DATABASE_URL` `fromDatabase` with a documented secret (delete the env var entry entirely from YAML — set only in Dashboard):

```yaml
services:
  - type: web
    name: mindyourlanguage
    runtime: node
    region: oregon
    plan: free
    buildCommand: npm ci --include=dev && npm run import-cedict && npm run build
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
        value: gpt-5.6-luna
      - key: RATE_LIMIT_PER_MIN
        value: "20"
      - key: CEDICT_FETCH
        value: "1"
      # Phase 6: set in Dashboard (Neon direct URL, sslmode=require)
      - key: DATABASE_URL
        sync: false
      - key: AUTH_SECRET
        sync: false
      - key: AUTH_GOOGLE_ID
        sync: false
      - key: AUTH_GOOGLE_SECRET
        sync: false
      - key: AUTH_URL
        sync: false
```

- [ ] **Step 2: Update `.env.example`**

Append:

```bash
# Phase 6 — Neon (direct connection string, sslmode=require)
DATABASE_URL=

# Auth.js / NextAuth (Google OAuth)
AUTH_SECRET=
AUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

- [ ] **Step 3: Update README Deploy section**

Replace Render Postgres steps with:

1. Create Neon Free project in `aws-us-west-2`.
2. Run migrations `001` then `002` against Neon.
3. Set Render secrets: `DATABASE_URL`, `AUTH_*`, `AUTH_URL=https://<your-render-host>`.
4. Note: free web spin-down unchanged; Neon scale-to-zero adds cold start on first sync after idle.

- [ ] **Step 4: Commit**

```bash
git add render.yaml README.md apps/web/.env.example
git commit -m "docs: wire Phase 6 Neon and Auth env in Blueprint and README"
```

---

### Task 3: Postgres pool (`lib/db.ts`)

**Files:**
- Create: `apps/web/lib/db.ts`
- Create: `apps/web/lib/db.test.ts`
- Modify: `apps/web/package.json` (add `pg`, `@types/pg`)

**Interfaces:**
- Produces: `isDatabaseConfigured(): boolean`, `getPool(): Pool | null`, `query<T>(text, params?)`

- [ ] **Step 1: Install dependency**

```bash
npm install pg -w apps/web
npm install -D @types/pg -w apps/web
```

- [ ] **Step 2: Write failing tests**

Create `apps/web/lib/db.test.ts`:

```typescript
import { afterEach, describe, expect, it } from 'vitest'
import { isDatabaseConfigured } from './db'

describe('isDatabaseConfigured', () => {
  const original = process.env.DATABASE_URL

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = original
  })

  it('returns false when DATABASE_URL is empty', () => {
    delete process.env.DATABASE_URL
    expect(isDatabaseConfigured()).toBe(false)
  })

  it('returns true when DATABASE_URL is set', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host/db?sslmode=require'
    expect(isDatabaseConfigured()).toBe(true)
  })
})
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
npm test -w apps/web -- lib/db.test.ts
```

- [ ] **Step 4: Implement `lib/db.ts`**

```typescript
import { Pool, type QueryResultRow } from 'pg'

let pool: Pool | null = null

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export function getPool(): Pool | null {
  if (!isDatabaseConfigured()) return null
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return pool
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const p = getPool()
  if (!p) throw new Error('DATABASE_URL is not configured')
  const result = await p.query<T>(text, params)
  return result.rows
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npm test -w apps/web -- lib/db.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/db.ts apps/web/lib/db.test.ts apps/web/package.json package-lock.json
git commit -m "feat: add optional Postgres pool for Neon"
```

---

### Task 4: Row mappers

**Files:**
- Create: `apps/web/lib/db/mappers.ts`
- Create: `apps/web/lib/db/mappers.test.ts`

**Interfaces:**
- Produces: `translationRowToRecord`, `recordToTranslationRow`, `phrasebookRowToEntry`, `entryToPhrasebookRow`, `reviewEventRowToEvent`

- [ ] **Step 1: Write failing mapper test (history round-trip)**

Use one fixture row matching `TranslationRecord` from `@mindyourlanguage/shared`; assert JSON fields parse.

- [ ] **Step 2: Implement mappers** (map `segments`, `dictionary_matches`, `practice_stats` as JSON; dates as ISO strings)

- [ ] **Step 3: Run tests**

```bash
npm test -w apps/web -- lib/db/mappers.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/db/mappers.ts apps/web/lib/db/mappers.test.ts
git commit -m "feat: add Postgres row mappers for sync types"
```

---

## PR 6b — Auth (Google OAuth)

### Task 5: NextAuth + `users` provisioning

**Files:**
- Create: `apps/web/lib/db/users.ts`
- Create: `apps/web/lib/auth.ts`
- Create: `apps/web/lib/auth-session.ts`
- Create: `apps/web/app/api/auth/[...nextauth]/route.ts`
- Modify: `apps/web/package.json` (`next-auth`)

**Interfaces:**
- Produces: `auth()` from Auth.js, `requireUserId(): Promise<string>` throws `NextResponse` 401, `ensureUserByEmail(email): Promise<string>` (UUID)

- [ ] **Step 1: Install Auth.js**

```bash
npm install next-auth@5 -w apps/web
```

- [ ] **Step 2: Implement `ensureUserByEmail`**

```typescript
// apps/web/lib/db/users.ts
import { query } from '@/lib/db'

export async function ensureUserByEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase()
  const existing = await query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 LIMIT 1',
    [normalized],
  )
  if (existing[0]) return existing[0].id
  const inserted = await query<{ id: string }>(
    'INSERT INTO users (email) VALUES ($1) RETURNING id',
    [normalized],
  )
  return inserted[0].id
}
```

- [ ] **Step 3: Configure Auth.js** (`apps/web/lib/auth.ts`)

Use Google provider; in `signIn` callback call `ensureUserByEmail`; store Postgres `userId` on JWT; expose `session.user.id`.

- [ ] **Step 4: Route handler**

```typescript
// apps/web/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 5: `requireUserId`**

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function requireUserId(): Promise<string | NextResponse> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return id
}
```

- [ ] **Step 6: Manual smoke (local)**

Set `.env.local` with Google OAuth test app + Neon URL; visit `/api/auth/signin`; confirm `users` row created.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/auth.ts apps/web/lib/auth-session.ts apps/web/lib/db/users.ts apps/web/app/api/auth/
git commit -m "feat: add Google OAuth with Neon user provisioning"
```

---

## PR 6c — Sync API routes

### Task 6: History repository + `/api/history`

**Files:**
- Create: `apps/web/lib/db/history.ts`
- Create: `apps/web/app/api/history/route.ts`
- Create: `apps/web/app/api/history/route.test.ts`

**Interfaces:**
- Consumes: `requireUserId`, `query`, mappers, `HISTORY_MAX` from `@/lib/stores/history`

- [ ] **Step 1: Write failing API test** (mock `auth` + `query`; expect 401 without session; PUT trims to 50)

- [ ] **Step 2: Implement `upsertHistory(userId, items)`** — `INSERT ... ON CONFLICT (id) DO UPDATE`, delete older rows beyond 50 per user

- [ ] **Step 3: Implement route** GET lists ordered by `created_at DESC` limit 50

- [ ] **Step 4: Run tests**

```bash
npm test -w apps/web -- app/api/history/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add authenticated history sync API"
```

---

### Task 7: Phrasebook repository + `/api/phrasebook`

**Files:**
- Create: `apps/web/lib/db/phrasebook.ts`
- Create: `apps/web/app/api/phrasebook/route.ts`
- Create: `apps/web/app/api/phrasebook/route.test.ts`

- [ ] **Step 1–5:** Same pattern as Task 6 for `PhrasebookEntry[]` (no 50 cap)

- [ ] **Commit:** `feat: add authenticated phrasebook sync API`

---

### Task 8: Review events + `/api/review-events`

**Files:**
- Create: `apps/web/lib/db/review-events.ts`
- Create: `apps/web/app/api/review-events/route.ts`
- Create: `apps/web/app/api/review-events/route.test.ts`

- [ ] **Step 1:** POST appends with `ON CONFLICT (id) DO NOTHING` (idempotent)

- [ ] **Step 2:** GET returns last N events (default 500) for reliability needle

- [ ] **Commit:** `feat: add authenticated review event sync API`

---

## PR 6d — Client sync + header auth UI

### Task 9: Cloud sync orchestration

**Files:**
- Create: `apps/web/lib/sync/cloud-sync.ts`
- Create: `apps/web/lib/sync/cloud-sync.test.ts`

**Interfaces:**
- Produces: `mergeById<T>(local, remote)`, `syncAllStores(): Promise<void>` (browser fetch to PUT then GET)

- [ ] **Step 1: Pure merge tests**

```typescript
import { describe, expect, it } from 'vitest'
import { mergeById } from './cloud-sync'

describe('mergeById', () => {
  it('prefers remote when ids match and remote is newer', () => {
    const local = [{ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }]
    const remote = [{ id: 'a', createdAt: '2026-01-02T00:00:00.000Z' }]
    const merged = mergeById(local, remote, (row) => row.createdAt)
    expect(merged[0].createdAt).toBe('2026-01-02T00:00:00.000Z')
  })
})
```

- [ ] **Step 2: Implement `syncAllStores`**

Order: **push** local history → phrasebook → review events (PUT/POST), then **pull** GET each route and replace Zustand state via `useHistoryStore.setState`, etc.

On fetch failure: `toast.error('Cloud sync failed — using local data')`; do not throw.

- [ ] **Step 3: Run tests + commit**

```bash
npm test -w apps/web -- lib/sync/cloud-sync.test.ts
git commit -m "feat: add client cloud sync orchestration"
```

---

### Task 10: Auth header + onboarding hint

**Files:**
- Create: `apps/web/components/auth-header-actions.tsx` (client component)
- Create: `apps/web/components/onboarding-sync-hint.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1:** Header shows **Sign in with Google** when logged out; **Sign out** + email when logged in

- [ ] **Step 2:** After successful sign-in, call `syncAllStores()` once

- [ ] **Step 3:** `onboarding-sync-hint` — first login only (`localStorage` key `myl-onboarding-sync-done`): short dialog “Sign in syncs phrasebook and practice across devices.” Dismiss sets flag.

- [ ] **Step 4:** Wire stores to re-sync on phrasebook/history mutations when session present (debounced 2s `syncPushPhrasebook` optional — MVP: sync on login + manual refresh button in header)

- [ ] **Commit:** `feat: add auth header and post-login cloud sync`

---

## PR 6e — Per-user rate limits

### Task 11: Rate limit by user id

**Files:**
- Modify: `apps/web/lib/rate-limit.ts`
- Modify: `apps/web/lib/rate-limit.test.ts`
- Modify: `apps/web/app/api/translate/route.ts`
- Modify: `apps/web/app/api/practice/check/route.ts`

- [ ] **Step 1: Refactor to keyed buckets**

```typescript
export function checkRateLimitForKey(key: string): boolean {
  // same logic as checkRateLimit but key param instead of ip-only
}

export function checkRateLimit(ip: string): boolean {
  return checkRateLimitForKey(`ip:${ip}`)
}
```

- [ ] **Step 2: In translate route**, after parsing body:

```typescript
const session = await auth()
const rateKey = session?.user?.id
  ? `user:${session.user.id}`
  : `ip:${clientIpFromForwardedFor(req.headers.get('x-forwarded-for'))}`
if (!checkRateLimitForKey(rateKey)) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
}
```

- [ ] **Step 3: Mirror in check-attempt route**

- [ ] **Step 4: Tests for separate buckets per user vs ip**

- [ ] **Commit:** `feat: apply per-user rate limits when authenticated`

---

## PR 6f — E2E + regression

### Task 12: Playwright sync smoke (mocked)

**Files:**
- Create: `apps/web/e2e/sync-auth.spec.ts`

- [ ] **Step 1:** Mock `/api/auth/session` as logged out — existing history/phrasebook specs still pass

- [ ] **Step 2:** Mock session logged in + mock PUT/GET sync routes — save phrasebook → trigger sync → assert second page load shows entry (mocked server state)

- [ ] **Step 3: Run E2E**

```bash
npm run test:e2e -w apps/web
```

- [ ] **Commit:** `test: add mocked auth sync E2E coverage`

---

## PR 6g — Optional STT (defer)

**Out of band unless requested:**

- Browser `SpeechRecognition` in `try-first-panel.tsx` behind feature flag
- No server route required for MVP STT
- Document browser support matrix in spec addendum

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| Neon + Render split | Task 2 |
| `002_cloud_sync.sql` | Task 1 |
| `lib/db.ts` | Task 3 |
| OAuth Google | Task 5 |
| History API | Task 6 |
| Phrasebook API | Task 7 |
| Review events API | Task 8 |
| Local → cloud merge | Task 9 |
| Login header | Task 10 |
| Per-user rate limits | Task 11 |
| Onboarding &lt; 2 min | Task 10 hint |
| Infra docs | Task 2 |
| Translate works without DB | Tasks 3, 6–8 (guard routes); no health change |
| STT optional | PR 6g deferred |

---

## Execution order summary

| Task | PR | Depends on |
|---|---|---|
| 1 Migration 002 | 6a | — |
| 2 Blueprint + README | 6a | — |
| 3 `lib/db.ts` | 6a | — |
| 4 Mappers | 6a | 3 |
| 5 Auth | 6b | 3, 4 |
| 6 History API | 6c | 4, 5 |
| 7 Phrasebook API | 6c | 4, 5 |
| 8 Review events API | 6c | 4, 5 |
| 9 Client sync | 6d | 6–8 |
| 10 Auth UI | 6d | 5, 9 |
| 11 Rate limits | 6e | 5 |
| 12 E2E | 6f | 9, 10 |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-26-phase-6-public-readiness-neon.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
