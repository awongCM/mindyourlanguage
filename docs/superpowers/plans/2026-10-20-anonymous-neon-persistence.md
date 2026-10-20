# Anonymous Neon Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the deployed Render app, history, phrasebook, practice stats, and review events survive a page refresh because they are stored in Neon under an anonymous browser cookie, and the newest translation is shown again after a refresh.

**Architecture:** The three existing sync routes resolve a user from a NextAuth session first and otherwise from an httpOnly `myl_anon` cookie whose SHA-256 hash is stored in `users.anon_token_hash`. A client-side background sync pulls from Neon on page load, merges into the existing Zustand stores, then pushes (debounced) after changes. The page restores the newest history entry on load. With `DATABASE_URL` unset everything stays browser-only and silent.

**Tech Stack:** Next.js 16.2 App Router (route handlers, `cookies()` from `next/headers` is async), React 19, Zustand 5 persist, `pg`, Vitest 4, Playwright. Neon Postgres via `DATABASE_URL`.

**Spec:** `docs/superpowers/specs/2026-10-20-anonymous-neon-persistence-design.md`

## Global Constraints

- Neon only. No Render disk, no Render Postgres. Render service stays on the free plan with an ephemeral filesystem.
- Cookie `myl_anon`: 32 random bytes base64url; `httpOnly`, `sameSite=lax`, `secure` in production, `path=/`, lifetime 400 days. Only the SHA-256 hash is stored in the database.
- A `GET` with no valid cookie returns an empty list and creates nothing. Users are created only on `PUT`/`POST` with a non-empty payload. User creation is rate limited per client IP with `checkRateLimitForKey`.
- Google sign-in code stays in place and unused; a NextAuth session id still takes priority when present.
- Reuse existing tables, routes, `mergeById`, and Zustand stores. No new tables.
- Translate, dictionary, and `/api/health` keep working with Neon unset or unreachable. A `501` from a sync route is a silent skip, never a toast.
- On load the client pulls and merges before any push (the phrasebook `PUT` deletes server rows missing from the client list).
- Default Vitest and Playwright runs must pass without Neon, Google OAuth, or `DATABASE_URL`.
- Read `node_modules/next/dist/docs/` before using a Next.js API you have not used in this repo (`apps/web/AGENTS.md`).
- Run commands from the repo root `/Users/andywongcheeming/Projects/github-projects/mindyourlanguage` unless stated.

## Decisions beyond the spec (review these)

| Decision | Why it is needed |
|---|---|
| Background and on-load sync never toast; they `console.warn`. The manual "Sync now" button still toasts. | The sync now runs after every change. A toast per failed run would flood the screen when Neon is down. |
| `syncAllStores` merges server rows into the *current* local state and no longer does a second `GET` after each `PUT`/`POST`. | The old code replaced local state with a server snapshot, which can drop an item saved while a sync is in flight. The `PUT`/`POST` responses already return the full server list, so the extra `GET` only adds load. |
| `syncAllStores` is single-flight with one queued re-run. | Overlapping first writes could each create an anonymous user and orphan rows. |
| Pull/sync updates are flagged so the background subscriber ignores them. | Without the flag, applying server rows triggers another sync forever. |
| `requireUserId` is replaced by `resolveSyncUser`; routes no longer return `401`. | A missing session is now normal. |
| `DATABASE_URL: ''` is added to the Playwright web server env. | A developer's `.env.local` with a real Neon URL would otherwise make e2e write to Neon. |
| A test asserts `MIGRATION_FILES` equals the files in `db/migrations`. | `run-migrations.ts` hard-codes the list; forgetting `003` would silently skip it. |

## Known costs and risks (not fixed here)

- Each background sync sends the full history, phrasebook, and review-event lists, and the server upserts row by row. Cost grows with data size. A later change can send only changed rows or batch the inserts.
- Existing browser data from before Neon is uploaded on the first change after load, not on load itself.
- Deleting a phrase and refreshing within the 2 s debounce window can bring it back from the server.
- Clearing local data in the app does not clear Neon (the phrasebook empty-`PUT` guard and history trimming are unchanged).

## File Structure

| File | Responsibility |
|---|---|
| `db/migrations/003_anon_users.sql` (new) | `users.anon_token_hash` |
| `scripts/run-migrations.ts` | Export and extend `MIGRATION_FILES` |
| `apps/web/lib/db/users.ts` | Lookup and create anonymous user by token hash |
| `apps/web/lib/anon-identity.ts` (new) | Token generation, hashing, cookie read/set, rate limit, `resolveAnonUser` |
| `apps/web/lib/auth-session.ts` | `resolveSyncUser` (session, else anonymous) replacing `requireUserId` |
| `apps/web/app/api/history/route.ts`, `phrasebook/route.ts`, `review-events/route.ts` | Use `resolveSyncUser`; empty reads without identity; 429 on creation limit |
| `apps/web/lib/sync/cloud-sync.ts` | `pullAllStores`, safer `syncAllStores`, 501 handling, apply-remote flag |
| `apps/web/lib/sync/start-background-sync.ts` (new) | Pull once, then debounced push after store changes |
| `apps/web/components/cloud-persistence.tsx` (new) | Mounts the background sync |
| `apps/web/app/layout.tsx` | Render `<CloudPersistence />` |
| `apps/web/app/page.tsx` | Restore the newest history entry once |
| `apps/web/e2e/persistence.spec.ts` (new), `apps/web/playwright.config.ts` | Reload, server pull, quiet failure |
| `docs/neon-setup.md`, `context/project.md` | Migration 003 and anonymous mode notes |

---

### Task 1: Migration 003 and runner

**Files:**
- Create: `db/migrations/003_anon_users.sql`
- Modify: `scripts/run-migrations.ts:6`
- Modify: `scripts/run-migrations.test.ts`
- Modify: `docs/neon-setup.md` (psql and SQL-editor lists)

**Interfaces:**
- Produces: `users.anon_token_hash TEXT UNIQUE` (nullable); exported `MIGRATION_FILES` containing `'003_anon_users.sql'`.

- [ ] **Step 1: Create the migration**

`db/migrations/003_anon_users.sql`:

```sql
-- Anonymous browser identity: SHA-256 hex of the myl_anon cookie token.
-- Google users keep using users.email; anonymous users leave it NULL.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS anon_token_hash TEXT UNIQUE;
```

- [ ] **Step 2: Write the failing test**

Replace `scripts/run-migrations.test.ts` with:

```ts
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { MIGRATION_FILES, resolveDatabaseUrl } from './run-migrations'

describe('resolveDatabaseUrl', () => {
  const original = process.env.DATABASE_URL

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = original
  })

  it('prefers process.env.DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgresql://from-env'
    assert.equal(resolveDatabaseUrl(), 'postgresql://from-env')
  })
})

describe('MIGRATION_FILES', () => {
  it('lists every SQL file in db/migrations in order', () => {
    const dir = path.resolve(__dirname, '../db/migrations')
    const onDisk = fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.sql'))
      .sort()
    assert.deepEqual([...MIGRATION_FILES], onDisk)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx tsx --test scripts/run-migrations.test.ts`
Expected: FAIL (`MIGRATION_FILES` is not exported / does not include `003_anon_users.sql`).

- [ ] **Step 4: Export and extend the list**

In `scripts/run-migrations.ts` replace line 6:

```ts
export const MIGRATION_FILES = [
  '001_initial.sql',
  '002_cloud_sync.sql',
  '003_anon_users.sql',
] as const
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx tsx --test scripts/run-migrations.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Update the setup doc lists**

In `docs/neon-setup.md`, after the line `psql "$DATABASE_URL" -f db/migrations/002_cloud_sync.sql` add:

```bash
psql "$DATABASE_URL" -f db/migrations/003_anon_users.sql
```

and after the Option D item 2 line (`[`db/migrations/002_cloud_sync.sql`](../db/migrations/002_cloud_sync.sql) — sync columns + `review_events``) add:

```markdown
3. [`db/migrations/003_anon_users.sql`](../db/migrations/003_anon_users.sql) — `users.anon_token_hash` for anonymous browser identity
```

- [ ] **Step 7: Commit**

```bash
git add db/migrations/003_anon_users.sql scripts/run-migrations.ts scripts/run-migrations.test.ts docs/neon-setup.md
git commit -m "feat(db): add anonymous user token hash migration"
```

---

### Task 2: Anonymous identity (user queries and cookie logic)

**Files:**
- Modify: `apps/web/lib/db/users.ts`
- Create: `apps/web/lib/db/users.test.ts`
- Create: `apps/web/lib/anon-identity.ts`
- Create: `apps/web/lib/anon-identity.test.ts`

**Interfaces:**
- Consumes: `query` from `@/lib/db`; `checkRateLimitForKey`, `clientIpFromForwardedFor` from `@/lib/rate-limit`; `cookies`, `headers` from `next/headers`.
- Produces:
  - `findUserIdByAnonTokenHash(tokenHash: string): Promise<string | null>`
  - `createAnonUser(tokenHash: string): Promise<string>`
  - `ANON_COOKIE = 'myl_anon'`, `ANON_COOKIE_MAX_AGE_SECONDS = 34_560_000`
  - `generateAnonToken(): string`, `hashAnonToken(token: string): string`
  - `type AnonResolution = { kind: 'user'; userId: string } | { kind: 'none' } | { kind: 'rate_limited' }`
  - `resolveAnonUser(options: { create: boolean }): Promise<AnonResolution>`

- [ ] **Step 1: Write the failing user-query tests**

`apps/web/lib/db/users.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

import { query } from '@/lib/db'
import { createAnonUser, findUserIdByAnonTokenHash } from './users'

describe('anonymous users', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset()
  })

  it('findUserIdByAnonTokenHash returns the id when a row exists', async () => {
    vi.mocked(query).mockResolvedValue([{ id: 'user-1' }])

    await expect(findUserIdByAnonTokenHash('hash-1')).resolves.toBe('user-1')

    const [sql, params] = vi.mocked(query).mock.calls[0]!
    expect(String(sql)).toContain('anon_token_hash = $1')
    expect(params).toEqual(['hash-1'])
  })

  it('findUserIdByAnonTokenHash returns null when no row matches', async () => {
    vi.mocked(query).mockResolvedValue([])

    await expect(findUserIdByAnonTokenHash('missing')).resolves.toBeNull()
  })

  it('createAnonUser inserts only the hash and returns the new id', async () => {
    vi.mocked(query).mockResolvedValue([{ id: 'user-2' }])

    await expect(createAnonUser('hash-2')).resolves.toBe('user-2')

    const [sql, params] = vi.mocked(query).mock.calls[0]!
    expect(String(sql)).toContain('INSERT INTO users (anon_token_hash)')
    expect(String(sql)).not.toContain('email')
    expect(params).toEqual(['hash-2'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -w apps/web -- lib/db/users.test.ts`
Expected: FAIL (`createAnonUser` / `findUserIdByAnonTokenHash` are not exported).

- [ ] **Step 3: Implement the user queries**

Append to `apps/web/lib/db/users.ts`:

```ts

export async function findUserIdByAnonTokenHash(
  tokenHash: string,
): Promise<string | null> {
  const rows = await query<{ id: string }>(
    'SELECT id FROM users WHERE anon_token_hash = $1 LIMIT 1',
    [tokenHash],
  )
  return rows[0]?.id ?? null
}

export async function createAnonUser(tokenHash: string): Promise<string> {
  const rows = await query<{ id: string }>(
    'INSERT INTO users (anon_token_hash) VALUES ($1) RETURNING id',
    [tokenHash],
  )
  return rows[0].id
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -w apps/web -- lib/db/users.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing identity tests**

`apps/web/lib/anon-identity.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cookieStore = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }))
const headerStore = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
  headers: vi.fn(async () => headerStore),
}))

vi.mock('@/lib/db/users', () => ({
  findUserIdByAnonTokenHash: vi.fn(),
  createAnonUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitForKey: vi.fn(),
  clientIpFromForwardedFor: vi.fn(() => '203.0.113.9'),
}))

import { createAnonUser, findUserIdByAnonTokenHash } from '@/lib/db/users'
import { checkRateLimitForKey } from '@/lib/rate-limit'
import {
  ANON_COOKIE,
  ANON_COOKIE_MAX_AGE_SECONDS,
  generateAnonToken,
  hashAnonToken,
  resolveAnonUser,
} from './anon-identity'

describe('anon token helpers', () => {
  it('generates distinct 43-character base64url tokens', () => {
    const a = generateAnonToken()
    const b = generateAnonToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
  })

  it('hashes to a stable 64-character hex digest that is not the token', () => {
    const hash = hashAnonToken('token-1')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashAnonToken('token-1')).toBe(hash)
    expect(hash).not.toBe('token-1')
  })
})

describe('resolveAnonUser', () => {
  beforeEach(() => {
    cookieStore.get.mockReset()
    cookieStore.set.mockReset()
    headerStore.get.mockReset()
    cookieStore.get.mockReturnValue(undefined)
    vi.mocked(findUserIdByAnonTokenHash).mockReset()
    vi.mocked(createAnonUser).mockReset()
    vi.mocked(checkRateLimitForKey).mockReset()
    vi.mocked(checkRateLimitForKey).mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the existing user when the cookie matches', async () => {
    cookieStore.get.mockReturnValue({ value: 'tok' })
    vi.mocked(findUserIdByAnonTokenHash).mockResolvedValue('user-1')

    await expect(resolveAnonUser({ create: false })).resolves.toEqual({
      kind: 'user',
      userId: 'user-1',
    })
    expect(findUserIdByAnonTokenHash).toHaveBeenCalledWith(hashAnonToken('tok'))
    expect(createAnonUser).not.toHaveBeenCalled()
    expect(cookieStore.set).not.toHaveBeenCalled()
  })

  it('returns none and touches nothing when reading without a cookie', async () => {
    await expect(resolveAnonUser({ create: false })).resolves.toEqual({
      kind: 'none',
    })
    expect(findUserIdByAnonTokenHash).not.toHaveBeenCalled()
    expect(createAnonUser).not.toHaveBeenCalled()
    expect(cookieStore.set).not.toHaveBeenCalled()
  })

  it('creates a user and sets an httpOnly cookie when writing without a cookie', async () => {
    vi.mocked(createAnonUser).mockResolvedValue('user-new')

    await expect(resolveAnonUser({ create: true })).resolves.toEqual({
      kind: 'user',
      userId: 'user-new',
    })

    const storedHash = vi.mocked(createAnonUser).mock.calls[0]![0]
    const [name, token, options] = cookieStore.set.mock.calls[0]!
    expect(name).toBe(ANON_COOKIE)
    expect(hashAnonToken(token as string)).toBe(storedHash)
    expect(token).not.toBe(storedHash)
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: ANON_COOKIE_MAX_AGE_SECONDS,
      secure: false,
    })
  })

  it('marks the cookie secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.mocked(createAnonUser).mockResolvedValue('user-new')

    await resolveAnonUser({ create: true })

    expect(cookieStore.set.mock.calls[0]![2]).toMatchObject({ secure: true })
  })

  it('replaces a stale cookie that matches no user when writing', async () => {
    cookieStore.get.mockReturnValue({ value: 'stale' })
    vi.mocked(findUserIdByAnonTokenHash).mockResolvedValue(null)
    vi.mocked(createAnonUser).mockResolvedValue('user-new')

    await expect(resolveAnonUser({ create: true })).resolves.toEqual({
      kind: 'user',
      userId: 'user-new',
    })
    expect(cookieStore.set).toHaveBeenCalledTimes(1)
  })

  it('returns none for a stale cookie when only reading', async () => {
    cookieStore.get.mockReturnValue({ value: 'stale' })
    vi.mocked(findUserIdByAnonTokenHash).mockResolvedValue(null)

    await expect(resolveAnonUser({ create: false })).resolves.toEqual({
      kind: 'none',
    })
    expect(createAnonUser).not.toHaveBeenCalled()
  })

  it('returns rate_limited without creating a user when the IP is over the limit', async () => {
    vi.mocked(checkRateLimitForKey).mockReturnValue(false)

    await expect(resolveAnonUser({ create: true })).resolves.toEqual({
      kind: 'rate_limited',
    })
    expect(checkRateLimitForKey).toHaveBeenCalledWith('anon-create:203.0.113.9')
    expect(createAnonUser).not.toHaveBeenCalled()
    expect(cookieStore.set).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm run test -w apps/web -- lib/anon-identity.test.ts`
Expected: FAIL (module `./anon-identity` not found).

- [ ] **Step 7: Implement `anon-identity.ts`**

`apps/web/lib/anon-identity.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { createAnonUser, findUserIdByAnonTokenHash } from '@/lib/db/users'
import {
  checkRateLimitForKey,
  clientIpFromForwardedFor,
} from '@/lib/rate-limit'

export const ANON_COOKIE = 'myl_anon'
export const ANON_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60

export type AnonResolution =
  | { kind: 'user'; userId: string }
  | { kind: 'none' }
  | { kind: 'rate_limited' }

export function generateAnonToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashAnonToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Resolve the anonymous user for this request's cookie.
 * Reads never create a user. With `create: true`, a missing or stale cookie
 * creates a user and sets a new httpOnly cookie (route handlers only).
 */
export async function resolveAnonUser(options: {
  create: boolean
}): Promise<AnonResolution> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ANON_COOKIE)?.value

  if (token) {
    const existing = await findUserIdByAnonTokenHash(hashAnonToken(token))
    if (existing) return { kind: 'user', userId: existing }
  }

  if (!options.create) return { kind: 'none' }

  const requestHeaders = await headers()
  const ip = clientIpFromForwardedFor(requestHeaders.get('x-forwarded-for'))
  if (!checkRateLimitForKey(`anon-create:${ip}`)) {
    return { kind: 'rate_limited' }
  }

  const newToken = generateAnonToken()
  const userId = await createAnonUser(hashAnonToken(newToken))
  cookieStore.set(ANON_COOKIE, newToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ANON_COOKIE_MAX_AGE_SECONDS,
  })
  return { kind: 'user', userId }
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm run test -w apps/web -- lib/anon-identity.test.ts lib/db/users.test.ts`
Expected: PASS (all tests in both files).

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/db/users.ts apps/web/lib/db/users.test.ts apps/web/lib/anon-identity.ts apps/web/lib/anon-identity.test.ts
git commit -m "feat(auth): resolve anonymous users from a hashed cookie token"
```

---

### Task 3: Sync routes use the resolved user

**Files:**
- Modify: `apps/web/lib/auth-session.ts` (full replacement)
- Modify: `apps/web/app/api/history/route.ts`, `apps/web/app/api/phrasebook/route.ts`, `apps/web/app/api/review-events/route.ts` (full replacements)
- Modify: `apps/web/app/api/history/route.test.ts`, `apps/web/app/api/phrasebook/route.test.ts`, `apps/web/app/api/review-events/route.test.ts` (full replacements)

**Interfaces:**
- Consumes: `resolveAnonUser`, `AnonResolution` from Task 2; `auth` from `@/lib/auth`.
- Produces: `resolveSyncUser(options: { create: boolean }): Promise<AnonResolution>`. Routes: `GET` returns `{ items: [] }` / `{ events: [] }` when `kind !== 'user'`; `PUT`/`POST` call with `create: payload.length > 0`, return `429` on `rate_limited`, empty payload on `none`.

- [ ] **Step 1: Write the failing history route tests**

Replace `apps/web/app/api/history/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TranslationRecord } from '@mindyourlanguage/shared'
import { GET, PUT } from './route'
import { HISTORY_MAX } from '@/lib/stores/history'

vi.mock('@/lib/auth-session', () => ({
  resolveSyncUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: vi.fn(),
}))

vi.mock('@/lib/db/history', () => ({
  listHistory: vi.fn(),
  upsertHistory: vi.fn(),
}))

import { resolveSyncUser } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import { listHistory, upsertHistory } from '@/lib/db/history'

function sampleRecord(index: number): TranslationRecord {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    userId: null,
    sourceText: `text-${index}`,
    sourceLang: 'en',
    targetLang: 'zh',
    translation: `你好-${index}`,
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
    createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  }
}

function putRequest(items: TranslationRecord[]) {
  return new Request('http://localhost/api/history', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
}

describe('/api/history', () => {
  beforeEach(() => {
    vi.mocked(resolveSyncUser).mockReset()
    vi.mocked(isDatabaseConfigured).mockReset()
    vi.mocked(listHistory).mockReset()
    vi.mocked(upsertHistory).mockReset()
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
  })

  it('GET returns 501 when the database is not configured', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false)

    const res = await GET()
    expect(res.status).toBe(501)
    expect(resolveSyncUser).not.toHaveBeenCalled()
  })

  it('GET returns an empty list when the browser has no identity yet', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(listHistory).not.toHaveBeenCalled()
  })

  it('GET returns items for the resolved user', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    const items = [sampleRecord(1)]
    vi.mocked(listHistory).mockResolvedValue(items)

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items })
    expect(listHistory).toHaveBeenCalledWith('user-1')
  })

  it('GET returns 503 when database query fails', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(listHistory).mockRejectedValue(new Error('db down'))

    const res = await GET()
    expect(res.status).toBe(503)
  })

  it('PUT caps items at HISTORY_MAX', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    const many = Array.from({ length: HISTORY_MAX + 5 }, (_, i) =>
      sampleRecord(i),
    )
    vi.mocked(upsertHistory).mockImplementation(async (_userId, items) =>
      items.slice(0, HISTORY_MAX),
    )

    const res = await PUT(putRequest(many) as never)
    expect(res.status).toBe(200)
    expect(vi.mocked(upsertHistory).mock.calls[0]?.[1]).toHaveLength(
      HISTORY_MAX + 5,
    )
    const json = await res.json()
    expect(json.items).toHaveLength(HISTORY_MAX)
  })

  it('PUT with items may create the anonymous user', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(upsertHistory).mockResolvedValue([sampleRecord(1)])

    await PUT(putRequest([sampleRecord(1)]) as never)
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: true })
  })

  it('PUT with no items never creates a user and returns an empty list', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await PUT(putRequest([]) as never)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(upsertHistory).not.toHaveBeenCalled()
  })

  it('PUT returns 429 when anonymous user creation is rate limited', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'rate_limited' })

    const res = await PUT(putRequest([sampleRecord(1)]) as never)
    expect(res.status).toBe(429)
    expect(upsertHistory).not.toHaveBeenCalled()
  })

  it('PUT returns 400 for an invalid body', async () => {
    const req = new Request('http://localhost/api/history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: 'nope' }),
    })

    const res = await PUT(req as never)
    expect(res.status).toBe(400)
    expect(resolveSyncUser).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Write the failing phrasebook route tests**

Replace `apps/web/app/api/phrasebook/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PhrasebookEntry } from '@mindyourlanguage/shared'
import { GET, PUT } from './route'

vi.mock('@/lib/auth-session', () => ({
  resolveSyncUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: vi.fn(),
}))

vi.mock('@/lib/db/phrasebook', () => ({
  listPhrasebook: vi.fn(),
  upsertPhrasebook: vi.fn(),
}))

import { resolveSyncUser } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import { listPhrasebook, upsertPhrasebook } from '@/lib/db/phrasebook'

const sampleEntry: PhrasebookEntry = {
  id: '11111111-1111-4111-8111-111111111111',
  translationId: null,
  sourceText: 'Hello',
  sourceLang: 'en',
  targetLang: 'zh',
  translation: '你好',
  characterSet: 'simplified',
  dictionaryMatches: [],
  segments: [],
  tags: [],
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
}

function putRequest(items: PhrasebookEntry[]) {
  return new Request('http://localhost/api/phrasebook', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
}

describe('/api/phrasebook', () => {
  beforeEach(() => {
    vi.mocked(resolveSyncUser).mockReset()
    vi.mocked(isDatabaseConfigured).mockReset()
    vi.mocked(listPhrasebook).mockReset()
    vi.mocked(upsertPhrasebook).mockReset()
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
  })

  it('GET returns 501 when the database is not configured', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false)

    const res = await GET()
    expect(res.status).toBe(501)
  })

  it('GET returns an empty list when the browser has no identity yet', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(listPhrasebook).not.toHaveBeenCalled()
  })

  it('GET returns phrasebook items', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(listPhrasebook).mockResolvedValue([sampleEntry])

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [sampleEntry] })
  })

  it('PUT upserts and returns items', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(upsertPhrasebook).mockResolvedValue([sampleEntry])

    const res = await PUT(putRequest([sampleEntry]) as never)
    expect(res.status).toBe(200)
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: true })
    expect(upsertPhrasebook).toHaveBeenCalledWith('user-1', [sampleEntry])
  })

  it('PUT with no items never creates a user and returns an empty list', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await PUT(putRequest([]) as never)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(upsertPhrasebook).not.toHaveBeenCalled()
  })

  it('PUT returns 429 when anonymous user creation is rate limited', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'rate_limited' })

    const res = await PUT(putRequest([sampleEntry]) as never)
    expect(res.status).toBe(429)
    expect(upsertPhrasebook).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Write the failing review-events route tests**

Replace `apps/web/app/api/review-events/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { ReviewEvent } from '@mindyourlanguage/shared'
import { GET, POST } from './route'

vi.mock('@/lib/auth-session', () => ({
  resolveSyncUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: vi.fn(),
}))

vi.mock('@/lib/db/review-events', () => ({
  listReviewEvents: vi.fn(),
  appendReviewEvents: vi.fn(),
  DEFAULT_REVIEW_EVENTS_LIMIT: 500,
}))

import { resolveSyncUser } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import { appendReviewEvents, listReviewEvents } from '@/lib/db/review-events'

const sampleEvent: ReviewEvent = {
  id: '22222222-2222-4222-8222-222222222222',
  phraseId: '11111111-1111-4111-8111-111111111111',
  grade: 'good',
  reviewedAt: '2026-01-01T00:00:00.000Z',
  mode: 'self_grade',
}

function postRequest(events: ReviewEvent[]) {
  return new Request('http://localhost/api/review-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  })
}

describe('/api/review-events', () => {
  beforeEach(() => {
    vi.mocked(resolveSyncUser).mockReset()
    vi.mocked(isDatabaseConfigured).mockReset()
    vi.mocked(listReviewEvents).mockReset()
    vi.mocked(appendReviewEvents).mockReset()
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
  })

  it('GET returns 501 when the database is not configured', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false)

    const res = await GET(new NextRequest('http://localhost/api/review-events'))
    expect(res.status).toBe(501)
  })

  it('GET returns an empty list when the browser has no identity yet', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await GET(new NextRequest('http://localhost/api/review-events'))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ events: [] })
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(listReviewEvents).not.toHaveBeenCalled()
  })

  it('GET returns events', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(listReviewEvents).mockResolvedValue([sampleEvent])

    const res = await GET(new NextRequest('http://localhost/api/review-events'))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ events: [sampleEvent] })
  })

  it('POST appends events', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({
      kind: 'user',
      userId: 'user-1',
    })
    vi.mocked(appendReviewEvents).mockResolvedValue([sampleEvent])

    const res = await POST(postRequest([sampleEvent]) as never)
    expect(res.status).toBe(200)
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: true })
    expect(appendReviewEvents).toHaveBeenCalledWith('user-1', [sampleEvent])
  })

  it('POST with no events never creates a user and returns an empty list', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'none' })

    const res = await POST(postRequest([]) as never)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ events: [] })
    expect(resolveSyncUser).toHaveBeenCalledWith({ create: false })
    expect(appendReviewEvents).not.toHaveBeenCalled()
  })

  it('POST returns 429 when anonymous user creation is rate limited', async () => {
    vi.mocked(resolveSyncUser).mockResolvedValue({ kind: 'rate_limited' })

    const res = await POST(postRequest([sampleEvent]) as never)
    expect(res.status).toBe(429)
    expect(appendReviewEvents).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run to verify they fail**

Run: `npm run test -w apps/web -- app/api/history/route.test.ts app/api/phrasebook/route.test.ts app/api/review-events/route.test.ts`
Expected: FAIL (routes still import `requireUserId`; `resolveSyncUser` is not defined).

- [ ] **Step 5: Replace `auth-session.ts`**

`apps/web/lib/auth-session.ts`:

```ts
import { auth } from '@/lib/auth'
import { resolveAnonUser, type AnonResolution } from '@/lib/anon-identity'

/**
 * Who owns the rows for this request: a signed-in Google user if there is a
 * session, otherwise the anonymous browser identity from the myl_anon cookie.
 */
export async function resolveSyncUser(options: {
  create: boolean
}): Promise<AnonResolution> {
  const session = await auth()
  const sessionUserId = session?.user?.id
  if (sessionUserId) return { kind: 'user', userId: sessionUserId }
  return resolveAnonUser(options)
}
```

- [ ] **Step 6: Replace the history route**

`apps/web/app/api/history/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import type { TranslationRecord } from '@mindyourlanguage/shared'
import { resolveSyncUser } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import { listHistory, upsertHistory } from '@/lib/db/history'

function syncNotConfigured(): NextResponse {
  return NextResponse.json(
    { error: 'Cloud sync is not configured' },
    { status: 501 },
  )
}

function syncDatabaseError(): NextResponse {
  return NextResponse.json({ error: 'Database error' }, { status: 503 })
}

export async function GET(): Promise<NextResponse> {
  if (!isDatabaseConfigured()) return syncNotConfigured()

  try {
    const resolution = await resolveSyncUser({ create: false })
    if (resolution.kind !== 'user') return NextResponse.json({ items: [] })

    const items = await listHistory(resolution.userId)
    return NextResponse.json({ items })
  } catch {
    return syncDatabaseError()
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  if (!isDatabaseConfigured()) return syncNotConfigured()

  let body: { items?: TranslationRecord[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 })
  }

  try {
    const resolution = await resolveSyncUser({ create: body.items.length > 0 })
    if (resolution.kind === 'rate_limited') {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (resolution.kind === 'none') return NextResponse.json({ items: [] })

    const items = await upsertHistory(resolution.userId, body.items)
    return NextResponse.json({ items })
  } catch {
    return syncDatabaseError()
  }
}
```

- [ ] **Step 7: Replace the phrasebook route**

`apps/web/app/api/phrasebook/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import type { PhrasebookEntry } from '@mindyourlanguage/shared'
import { resolveSyncUser } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import { listPhrasebook, upsertPhrasebook } from '@/lib/db/phrasebook'

function syncNotConfigured(): NextResponse {
  return NextResponse.json(
    { error: 'Cloud sync is not configured' },
    { status: 501 },
  )
}

function syncDatabaseError(): NextResponse {
  return NextResponse.json({ error: 'Database error' }, { status: 503 })
}

export async function GET(): Promise<NextResponse> {
  if (!isDatabaseConfigured()) return syncNotConfigured()

  try {
    const resolution = await resolveSyncUser({ create: false })
    if (resolution.kind !== 'user') return NextResponse.json({ items: [] })

    const items = await listPhrasebook(resolution.userId)
    return NextResponse.json({ items })
  } catch {
    return syncDatabaseError()
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  if (!isDatabaseConfigured()) return syncNotConfigured()

  let body: { items?: PhrasebookEntry[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 })
  }

  try {
    const resolution = await resolveSyncUser({ create: body.items.length > 0 })
    if (resolution.kind === 'rate_limited') {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (resolution.kind === 'none') return NextResponse.json({ items: [] })

    const items = await upsertPhrasebook(resolution.userId, body.items)
    return NextResponse.json({ items })
  } catch {
    return syncDatabaseError()
  }
}
```

- [ ] **Step 8: Replace the review-events route**

`apps/web/app/api/review-events/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import type { ReviewEvent } from '@mindyourlanguage/shared'
import { resolveSyncUser } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import {
  appendReviewEvents,
  DEFAULT_REVIEW_EVENTS_LIMIT,
  listReviewEvents,
} from '@/lib/db/review-events'

function syncNotConfigured(): NextResponse {
  return NextResponse.json(
    { error: 'Cloud sync is not configured' },
    { status: 501 },
  )
}

function syncDatabaseError(): NextResponse {
  return NextResponse.json({ error: 'Database error' }, { status: 503 })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isDatabaseConfigured()) return syncNotConfigured()

  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = limitParam
    ? Number.parseInt(limitParam, 10)
    : DEFAULT_REVIEW_EVENTS_LIMIT
  const safeLimit =
    Number.isFinite(limit) && limit > 0
      ? Math.min(limit, 1000)
      : DEFAULT_REVIEW_EVENTS_LIMIT

  try {
    const resolution = await resolveSyncUser({ create: false })
    if (resolution.kind !== 'user') return NextResponse.json({ events: [] })

    const events = await listReviewEvents(resolution.userId, safeLimit)
    return NextResponse.json({ events })
  } catch {
    return syncDatabaseError()
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isDatabaseConfigured()) return syncNotConfigured()

  let body: { events?: ReviewEvent[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.events)) {
    return NextResponse.json({ error: 'events array required' }, { status: 400 })
  }

  try {
    const resolution = await resolveSyncUser({ create: body.events.length > 0 })
    if (resolution.kind === 'rate_limited') {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (resolution.kind === 'none') return NextResponse.json({ events: [] })

    const events = await appendReviewEvents(resolution.userId, body.events)
    return NextResponse.json({ events })
  } catch {
    return syncDatabaseError()
  }
}
```

- [ ] **Step 9: Run to verify they pass**

Run: `npm run test -w apps/web -- app/api/history/route.test.ts app/api/phrasebook/route.test.ts app/api/review-events/route.test.ts`
Expected: PASS (all tests in the three files).

- [ ] **Step 10: Confirm nothing else used `requireUserId`**

Run: `rg "requireUserId" apps/web`
Expected: no matches.

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit -p apps/web`
Expected: exits 0 with no errors.

- [ ] **Step 12: Commit**

```bash
git add apps/web/lib/auth-session.ts apps/web/app/api/history apps/web/app/api/phrasebook apps/web/app/api/review-events
git commit -m "feat(api): serve sync routes from session or anonymous cookie identity"
```

---

### Task 4: Client sync (pull, safe push, silent 501)

**Files:**
- Modify: `apps/web/lib/sync/cloud-sync.ts` (full replacement)
- Modify: `apps/web/lib/sync/cloud-sync.test.ts` (keep existing tests, add mocks at the top and new `describe` blocks)

**Interfaces:**
- Consumes: the three routes from Task 3 (`GET /api/history`, `/api/phrasebook`, `/api/review-events`; `PUT /api/history`, `PUT /api/phrasebook`, `POST /api/review-events`); stores `useHistoryStore`, `usePhrasebookStore`, `useReviewEventsStore`; `HISTORY_MAX`.
- Produces:
  - `class SyncNotConfiguredError extends Error`
  - `type SyncOptions = { quiet?: boolean }`, `type PullResult = 'ok' | 'not_configured' | 'failed'`
  - `mergeHistory(local: TranslationRecord[], remote: TranslationRecord[]): TranslationRecord[]` (newest first, capped at `HISTORY_MAX`)
  - `isApplyingRemoteState(): boolean`
  - `pullAllStores(): Promise<PullResult>`
  - `syncAllStores(options?: SyncOptions): Promise<void>` (single-flight with one queued re-run)
  - existing `mergeById`, `phrasebookEntryUpdatedAt` unchanged.

- [ ] **Step 1: Add the failing tests**

At the very top of `apps/web/lib/sync/cloud-sync.test.ts`, replace the first two lines

```ts
import { describe, expect, it } from 'vitest'
import { mergeById, phrasebookEntryUpdatedAt } from './cloud-sync'
```

with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PhrasebookEntry,
  ReviewEvent,
  TranslationRecord,
} from '@mindyourlanguage/shared'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/lib/stores/wait-for-persist-hydration', () => ({
  waitForSyncStoresHydration: vi.fn().mockResolvedValue(undefined),
}))

import { toast } from 'sonner'
import { HISTORY_MAX, useHistoryStore } from '@/lib/stores/history'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
import { useReviewEventsStore } from '@/lib/stores/review-events'
import {
  isApplyingRemoteState,
  mergeById,
  mergeHistory,
  phrasebookEntryUpdatedAt,
  pullAllStores,
  syncAllStores,
} from './cloud-sync'
```

Then append to the end of the file:

```ts

function historyRecord(id: string, createdAt: string): TranslationRecord {
  return {
    id,
    userId: null,
    sourceText: `source-${id}`,
    sourceLang: 'en',
    targetLang: 'zh',
    translation: `translation-${id}`,
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
    createdAt,
  }
}

function phrasebookEntry(id: string): PhrasebookEntry {
  return {
    id,
    translationId: null,
    sourceText: `source-${id}`,
    sourceLang: 'en',
    targetLang: 'zh',
    translation: `translation-${id}`,
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
    tags: [],
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function reviewEvent(id: string, reviewedAt: string): ReviewEvent {
  return { id, phraseId: 'p-1', grade: 'good', reviewedAt, mode: 'self_grade' }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('mergeHistory', () => {
  it('sorts newest first and caps at HISTORY_MAX', () => {
    const local = [historyRecord('old', '2026-01-01T00:00:00.000Z')]
    const remote = Array.from({ length: HISTORY_MAX + 5 }, (_, i) =>
      historyRecord(`r-${i}`, new Date(Date.UTC(2026, 1, i + 1)).toISOString()),
    )

    const merged = mergeHistory(local, remote)

    expect(merged).toHaveLength(HISTORY_MAX)
    expect(merged[0]?.id).toBe(`r-${HISTORY_MAX + 4}`)
    expect(merged.some((row) => row.id === 'old')).toBe(false)
  })
})

describe('cloud sync against the API', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    vi.mocked(toast.error).mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    useHistoryStore.setState({ items: [] })
    usePhrasebookStore.setState({ items: [] })
    useReviewEventsStore.setState({ events: [] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('pullAllStores', () => {
    it('merges server rows into local state and flags the update as remote', async () => {
      useHistoryStore.setState({
        items: [historyRecord('local', '2026-01-01T00:00:00.000Z')],
      })
      fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/history') {
          return jsonResponse({
            items: [historyRecord('server', '2026-02-01T00:00:00.000Z')],
          })
        }
        if (url === '/api/phrasebook') {
          return jsonResponse({ items: [phrasebookEntry('pb-1')] })
        }
        return jsonResponse({
          events: [reviewEvent('ev-1', '2026-02-01T00:00:00.000Z')],
        })
      })

      const seenFlags: boolean[] = []
      const unsubscribe = useHistoryStore.subscribe(() => {
        seenFlags.push(isApplyingRemoteState())
      })

      await expect(pullAllStores()).resolves.toBe('ok')
      unsubscribe()

      expect(useHistoryStore.getState().items.map((row) => row.id)).toEqual([
        'server',
        'local',
      ])
      expect(usePhrasebookStore.getState().items.map((row) => row.id)).toEqual([
        'pb-1',
      ])
      expect(useReviewEventsStore.getState().events.map((row) => row.id)).toEqual(
        ['ev-1'],
      )
      expect(seenFlags).toEqual([true])
      expect(isApplyingRemoteState()).toBe(false)
      expect(fetchMock.mock.calls.every(([, init]) => init === undefined)).toBe(
        true,
      )
    })

    it('returns not_configured on 501 without a toast', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({ error: 'Cloud sync is not configured' }, 501),
      )

      await expect(pullAllStores()).resolves.toBe('not_configured')
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('returns failed on a server error without a toast', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({ error: 'Database error' }, 503),
      )

      await expect(pullAllStores()).resolves.toBe('failed')
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('does not overwrite local data with an empty server response', async () => {
      useHistoryStore.setState({
        items: [historyRecord('local', '2026-01-01T00:00:00.000Z')],
      })
      usePhrasebookStore.setState({ items: [phrasebookEntry('pb-local')] })
      fetchMock.mockImplementation(async (url: string) =>
        jsonResponse(url === '/api/review-events' ? { events: [] } : { items: [] }),
      )

      await pullAllStores()

      expect(useHistoryStore.getState().items).toHaveLength(1)
      expect(usePhrasebookStore.getState().items).toHaveLength(1)
    })
  })

  describe('syncAllStores', () => {
    function okSyncResponses() {
      fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/review-events') return jsonResponse({ events: [] })
        return jsonResponse({ items: [] })
      })
    }

    it('pushes all three stores with PUT/PUT/POST in order', async () => {
      okSyncResponses()
      useHistoryStore.setState({
        items: [historyRecord('h-1', '2026-01-01T00:00:00.000Z')],
      })
      usePhrasebookStore.setState({ items: [phrasebookEntry('pb-1')] })
      useReviewEventsStore.setState({
        events: [reviewEvent('ev-1', '2026-01-01T00:00:00.000Z')],
      })

      await syncAllStores({ quiet: true })

      expect(
        fetchMock.mock.calls.map(([url, init]) => [url, init?.method]),
      ).toEqual([
        ['/api/history', 'PUT'],
        ['/api/phrasebook', 'PUT'],
        ['/api/review-events', 'POST'],
      ])
    })

    it('keeps an item saved locally while the sync was in flight', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/review-events') {
          useHistoryStore.setState({
            items: [historyRecord('during', '2026-03-01T00:00:00.000Z')],
          })
          return jsonResponse({ events: [] })
        }
        return jsonResponse({ items: [] })
      })

      await syncAllStores({ quiet: true })

      expect(useHistoryStore.getState().items.map((row) => row.id)).toEqual([
        'during',
      ])
    })

    it('stays silent on 501', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({ error: 'Cloud sync is not configured' }, 501),
      )

      await syncAllStores()

      expect(toast.error).not.toHaveBeenCalled()
    })

    it('does not toast on a failed background sync', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({ error: 'Database error' }, 503),
      )

      await syncAllStores({ quiet: true })

      expect(toast.error).not.toHaveBeenCalled()
    })

    it('toasts on a failed manual sync', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({ error: 'Database error' }, 503),
      )

      await syncAllStores()

      expect(toast.error).toHaveBeenCalledWith(
        'Cloud sync failed — using local data',
      )
    })

    it('runs one sync at a time and queues a single re-run', async () => {
      let release: () => void = () => undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let firstCall = true
      fetchMock.mockImplementation(async (url: string) => {
        if (firstCall) {
          firstCall = false
          await gate
        }
        return jsonResponse(url === '/api/review-events' ? { events: [] } : { items: [] })
      })

      const first = syncAllStores({ quiet: true })
      const second = syncAllStores({ quiet: true })
      const third = syncAllStores({ quiet: true })
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

      release()
      await Promise.all([first, second, third])
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6))
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -w apps/web -- lib/sync/cloud-sync.test.ts`
Expected: FAIL (`mergeHistory`, `pullAllStores`, `isApplyingRemoteState` are not exported).

- [ ] **Step 3: Replace `cloud-sync.ts`**

`apps/web/lib/sync/cloud-sync.ts`:

```ts
import type {
  PhrasebookEntry,
  ReviewEvent,
  TranslationRecord,
} from '@mindyourlanguage/shared'
import { toast } from 'sonner'
import { HISTORY_MAX, useHistoryStore } from '@/lib/stores/history'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
import { useReviewEventsStore } from '@/lib/stores/review-events'
import { waitForSyncStoresHydration } from '@/lib/stores/wait-for-persist-hydration'

type Identifiable = { id: string }

export class SyncNotConfiguredError extends Error {
  constructor() {
    super('Cloud sync is not configured')
    this.name = 'SyncNotConfiguredError'
  }
}

export type SyncOptions = { quiet?: boolean }
export type PullResult = 'ok' | 'not_configured' | 'failed'

let applyingRemote = false

/** True while server rows are being written into the stores. */
export function isApplyingRemoteState(): boolean {
  return applyingRemote
}

function applyRemote(apply: () => void): void {
  applyingRemote = true
  try {
    apply()
  } finally {
    applyingRemote = false
  }
}

export function mergeById<T extends Identifiable>(
  local: T[],
  remote: T[],
  getUpdatedAt: (row: T) => string,
): T[] {
  const byId = new Map<string, T>()

  for (const row of local) {
    byId.set(row.id, row)
  }

  for (const row of remote) {
    const existing = byId.get(row.id)
    if (!existing) {
      byId.set(row.id, row)
      continue
    }
    const existingMs = Date.parse(getUpdatedAt(existing))
    const remoteMs = Date.parse(getUpdatedAt(row))
    byId.set(row.id, remoteMs >= existingMs ? row : existing)
  }

  return [...byId.values()]
}

export function mergeHistory(
  local: TranslationRecord[],
  remote: TranslationRecord[],
): TranslationRecord[] {
  return mergeById(local, remote, (row) => row.createdAt)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, HISTORY_MAX)
}

export function phrasebookEntryUpdatedAt(entry: PhrasebookEntry): string {
  const reviewedAt = entry.practiceStats?.lastReviewedAt
  if (reviewedAt) {
    const reviewedMs = Date.parse(reviewedAt)
    const createdMs = Date.parse(entry.createdAt)
    if (!Number.isNaN(reviewedMs) && reviewedMs >= createdMs) {
      return reviewedAt
    }
  }
  return entry.createdAt
}

async function readJson<T>(res: Response): Promise<T> {
  if (res.status === 501) throw new SyncNotConfiguredError()
  if (!res.ok) {
    throw new Error(`Sync request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

async function sendJson<T>(
  url: string,
  method: 'PUT' | 'POST',
  body: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readJson<T>(res)
}

/** Merge server rows into the current local state (read at call time). */
function applyRemoteRows(rows: {
  history: TranslationRecord[]
  phrasebook: PhrasebookEntry[]
  events: ReviewEvent[]
}): void {
  applyRemote(() => {
    useHistoryStore.setState({
      items: mergeHistory(useHistoryStore.getState().items, rows.history),
    })
    usePhrasebookStore.setState({
      items: mergeById(
        usePhrasebookStore.getState().items,
        rows.phrasebook,
        phrasebookEntryUpdatedAt,
      ),
    })
    useReviewEventsStore.setState({
      events: mergeById(
        useReviewEventsStore.getState().events,
        rows.events,
        (row) => row.reviewedAt,
      ),
    })
  })
}

/** Load this browser's rows from the server and merge them locally. Never pushes. */
export async function pullAllStores(): Promise<PullResult> {
  if (typeof window === 'undefined') return 'failed'

  try {
    await waitForSyncStoresHydration()

    const [historyRes, phrasebookRes, eventsRes] = await Promise.all([
      fetch('/api/history'),
      fetch('/api/phrasebook'),
      fetch('/api/review-events'),
    ])
    const history = await readJson<{ items: TranslationRecord[] }>(historyRes)
    const phrasebook = await readJson<{ items: PhrasebookEntry[] }>(
      phrasebookRes,
    )
    const events = await readJson<{ events: ReviewEvent[] }>(eventsRes)

    applyRemoteRows({
      history: history.items,
      phrasebook: phrasebook.items,
      events: events.events,
    })
    return 'ok'
  } catch (error) {
    if (error instanceof SyncNotConfiguredError) return 'not_configured'
    console.warn('Cloud pull failed', error)
    return 'failed'
  }
}

async function runSync(options: SyncOptions): Promise<void> {
  try {
    await waitForSyncStoresHydration()

    const history = await sendJson<{ items: TranslationRecord[] }>(
      '/api/history',
      'PUT',
      { items: useHistoryStore.getState().items },
    )
    const phrasebook = await sendJson<{ items: PhrasebookEntry[] }>(
      '/api/phrasebook',
      'PUT',
      { items: usePhrasebookStore.getState().items },
    )
    const events = await sendJson<{ events: ReviewEvent[] }>(
      '/api/review-events',
      'POST',
      { events: useReviewEventsStore.getState().events },
    )

    applyRemoteRows({
      history: history.items,
      phrasebook: phrasebook.items,
      events: events.events,
    })
  } catch (error) {
    if (error instanceof SyncNotConfiguredError) return
    if (options.quiet) {
      console.warn('Background cloud sync failed', error)
      return
    }
    toast.error('Cloud sync failed — using local data')
  }
}

let inFlight: Promise<void> | null = null
let queuedOptions: SyncOptions | null = null

/**
 * Push local rows, then merge the server's answer into the current local
 * state. One run at a time; calls made during a run queue a single re-run.
 */
export function syncAllStores(options: SyncOptions = {}): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()

  if (inFlight) {
    queuedOptions = options
    return inFlight
  }

  inFlight = runSync(options).finally(() => {
    inFlight = null
    if (queuedOptions) {
      const next = queuedOptions
      queuedOptions = null
      void syncAllStores(next)
    }
  })
  return inFlight
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -w apps/web -- lib/sync/cloud-sync.test.ts`
Expected: PASS (existing `mergeById` / `phrasebookEntryUpdatedAt` tests plus the new ones).

If `pushes all three stores…` reports a different call order, the module-level single-flight state is leaking from an earlier test: confirm each earlier test awaited its promise before finishing.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p apps/web`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/sync/cloud-sync.ts apps/web/lib/sync/cloud-sync.test.ts
git commit -m "feat(sync): pull on load, merge into current state, silent 501, single-flight push"
```

---

### Task 5: Background sync on load and after changes

**Files:**
- Create: `apps/web/lib/sync/start-background-sync.ts`
- Create: `apps/web/lib/sync/start-background-sync.test.ts`
- Create: `apps/web/components/cloud-persistence.tsx`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: `pullAllStores`, `syncAllStores`, `isApplyingRemoteState` from Task 4; the three stores' `subscribe`.
- Produces: `BACKGROUND_SYNC_DEBOUNCE_MS = 2000`; `startBackgroundSync(): () => void` (returns a stop function); `<CloudPersistence />` renders `null`.

- [ ] **Step 1: Write the failing tests**

`apps/web/lib/sync/start-background-sync.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./cloud-sync', () => ({
  pullAllStores: vi.fn(),
  syncAllStores: vi.fn(),
  isApplyingRemoteState: vi.fn(),
}))

import { useHistoryStore } from '@/lib/stores/history'
import {
  isApplyingRemoteState,
  pullAllStores,
  syncAllStores,
} from './cloud-sync'
import {
  BACKGROUND_SYNC_DEBOUNCE_MS,
  startBackgroundSync,
} from './start-background-sync'

function touchHistory() {
  useHistoryStore.setState({ items: [] })
}

describe('startBackgroundSync', () => {
  let stop: () => void = () => undefined

  async function start() {
    stop = startBackgroundSync()
    await vi.advanceTimersByTimeAsync(0)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(pullAllStores).mockReset().mockResolvedValue('ok')
    vi.mocked(syncAllStores).mockReset().mockResolvedValue(undefined)
    vi.mocked(isApplyingRemoteState).mockReset().mockReturnValue(false)
  })

  afterEach(() => {
    stop()
    stop = () => undefined
    vi.useRealTimers()
  })

  it('pulls once and does not push when nothing changes', async () => {
    await start()

    await vi.advanceTimersByTimeAsync(10_000)

    expect(pullAllStores).toHaveBeenCalledTimes(1)
    expect(syncAllStores).not.toHaveBeenCalled()
  })

  it('pushes quietly after the debounce and collapses rapid changes', async () => {
    await start()

    touchHistory()
    await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS - 1)
    touchHistory()
    await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS - 1)
    expect(syncAllStores).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(syncAllStores).toHaveBeenCalledTimes(1)
    expect(syncAllStores).toHaveBeenCalledWith({ quiet: true })
  })

  it('does not subscribe when sync is not configured on the server', async () => {
    vi.mocked(pullAllStores).mockResolvedValue('not_configured')
    await start()

    touchHistory()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(syncAllStores).not.toHaveBeenCalled()
  })

  it('still subscribes after a failed pull', async () => {
    vi.mocked(pullAllStores).mockResolvedValue('failed')
    await start()

    touchHistory()
    await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS)

    expect(syncAllStores).toHaveBeenCalledTimes(1)
  })

  it('ignores store updates that come from applying server rows', async () => {
    await start()
    vi.mocked(isApplyingRemoteState).mockReturnValue(true)

    touchHistory()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(syncAllStores).not.toHaveBeenCalled()
  })

  it('stop cancels a pending push and unsubscribes', async () => {
    await start()

    touchHistory()
    stop()
    await vi.advanceTimersByTimeAsync(5_000)
    touchHistory()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(syncAllStores).not.toHaveBeenCalled()
  })

  it('does not subscribe if stopped before the pull finishes', async () => {
    let finishPull: (value: 'ok') => void = () => undefined
    vi.mocked(pullAllStores).mockReturnValue(
      new Promise((resolve) => {
        finishPull = resolve
      }),
    )
    stop = startBackgroundSync()
    stop()
    finishPull('ok')
    await vi.advanceTimersByTimeAsync(0)

    touchHistory()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(syncAllStores).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -w apps/web -- lib/sync/start-background-sync.test.ts`
Expected: FAIL (module `./start-background-sync` not found).

- [ ] **Step 3: Implement the runner**

`apps/web/lib/sync/start-background-sync.ts`:

```ts
import { useHistoryStore } from '@/lib/stores/history'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
import { useReviewEventsStore } from '@/lib/stores/review-events'
import {
  isApplyingRemoteState,
  pullAllStores,
  syncAllStores,
} from './cloud-sync'

export const BACKGROUND_SYNC_DEBOUNCE_MS = 2000

/**
 * Pull this browser's rows once, then push (debounced, quiet) after local
 * changes. Returns a stop function. Does nothing further when the server
 * reports sync is not configured.
 */
export function startBackgroundSync(): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const unsubscribers: Array<() => void> = []

  function schedule() {
    if (isApplyingRemoteState()) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void syncAllStores({ quiet: true })
    }, BACKGROUND_SYNC_DEBOUNCE_MS)
  }

  void pullAllStores().then((result) => {
    if (stopped || result === 'not_configured') return
    unsubscribers.push(
      useHistoryStore.subscribe(schedule),
      usePhrasebookStore.subscribe(schedule),
      useReviewEventsStore.subscribe(schedule),
    )
  })

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    timer = null
    for (const unsubscribe of unsubscribers) unsubscribe()
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -w apps/web -- lib/sync/start-background-sync.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Add the component**

`apps/web/components/cloud-persistence.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { startBackgroundSync } from '@/lib/sync/start-background-sync'

/** Keeps this browser's history, phrasebook, and reviews in Neon. Renders nothing. */
export function CloudPersistence() {
  useEffect(() => startBackgroundSync(), [])
  return null
}
```

- [ ] **Step 6: Mount it in the layout**

In `apps/web/app/layout.tsx`, add the import under the existing `AuthHeaderActions` import:

```tsx
import { CloudPersistence } from "@/components/cloud-persistence";
```

and add the component as the first child inside `<AppSessionProvider>`, directly before `<header ...>`:

```tsx
        <AppSessionProvider>
          <CloudPersistence />
          <header className="sticky top-0 z-50 ...">
```

(Leave the existing `<header ...>` line exactly as it is; only the `<CloudPersistence />` line is new.)

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit -p apps/web && npm run lint -w apps/web`
Expected: both exit 0 with no errors. Fix any new warnings in the files above before continuing.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/sync/start-background-sync.ts apps/web/lib/sync/start-background-sync.test.ts apps/web/components/cloud-persistence.tsx apps/web/app/layout.tsx
git commit -m "feat(sync): pull on load and push quietly after local changes"
```

---

### Task 6: Restore the newest translation on load, end-to-end checks

**Files:**
- Modify: `apps/web/app/page.tsx` (imports at line 3; hooks after line 76; one effect after `restoreRecord`)
- Modify: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/persistence.spec.ts`

**Interfaces:**
- Consumes: `useHistoryStore`, existing `restoreRecord(record)` in `page.tsx`, the sync behavior from Tasks 4 and 5.
- Produces: after load, if the user has not typed or translated anything, `history[0]` fills the input and result once.

- [ ] **Step 1: Write the failing e2e spec**

`apps/web/e2e/persistence.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { enterSourceText, SAMPLE_TEXT } from './helpers/enter-source-text'
import { mockTranslateApi } from './helpers/mock-translate'

const TRANSLATION = '你好，很高兴认识你。'

const serverRecord = {
  id: 'server-history-1',
  userId: null,
  sourceText: SAMPLE_TEXT,
  sourceLang: 'en',
  targetLang: 'zh',
  translation: TRANSLATION,
  characterSet: 'simplified',
  dictionaryMatches: [],
  segments: [],
  createdAt: '2026-01-01T00:00:00.000Z',
}

test.describe('persistence across refresh (mocked)', () => {
  test('restores the latest translation after reload with browser storage only', async ({
    page,
  }) => {
    await mockTranslateApi(page)
    await page.goto('/')
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()

    await page.reload()

    await expect(page.getByTestId('result-translation')).toHaveText(TRANSLATION)
    await expect(page.getByPlaceholder('Enter text to translate…')).toHaveValue(
      SAMPLE_TEXT,
    )
    await expect(page.getByText('Cloud sync failed')).toHaveCount(0)
  })

  test('shows the latest translation from the server on a fresh browser', async ({
    page,
  }) => {
    await page.route('**/api/history', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [serverRecord] }),
      }),
    )
    await page.route('**/api/phrasebook', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      }),
    )
    await page.route('**/api/review-events**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [] }),
      }),
    )

    await page.goto('/')

    await expect(page.getByTestId('result-translation')).toHaveText(TRANSLATION)
    await expect(page.getByPlaceholder('Enter text to translate…')).toHaveValue(
      SAMPLE_TEXT,
    )
  })

  test('does not show a toast when a background sync fails', async ({ page }) => {
    await mockTranslateApi(page)
    await page.route('**/api/history', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [] }),
        })
      }
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database error' }),
      })
    })
    await page.route('**/api/phrasebook', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      }),
    )
    await page.route('**/api/review-events**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [] }),
      }),
    )

    const pulled = Promise.all(
      ['/api/history', '/api/phrasebook', '/api/review-events'].map((path) =>
        page.waitForResponse(
          (res) =>
            res.url().endsWith(path) && res.request().method() === 'GET',
        ),
      ),
    )
    await page.goto('/')
    await pulled

    const failedPush = page.waitForResponse(
      (res) =>
        res.url().endsWith('/api/history') && res.request().method() === 'PUT',
    )
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()

    expect((await failedPush).status()).toBe(503)
    await page.waitForTimeout(500)
    await expect(page.getByText('Cloud sync failed')).toHaveCount(0)
  })
})
```

- [ ] **Step 2: Keep e2e off a real database**

In `apps/web/playwright.config.ts`, add one line to the `webServer.env` object:

```ts
      DATABASE_URL: '',
```

so the block reads:

```ts
    env: {
      AUTH_SECRET: 'playwright-e2e-test-secret-min-32-chars',
      AUTH_URL: baseURL,
      NEXT_PUBLIC_GOOGLE_AUTH: 'true',
      DATABASE_URL: '',
    },
```

- [ ] **Step 3: Run to verify the restore tests fail**

Run: `npm run test:e2e -w apps/web -- e2e/persistence.spec.ts`
Expected: the first two tests FAIL (result is not shown after load; nothing restores it). The third test passes.

- [ ] **Step 4: Add the restore to the page**

In `apps/web/app/page.tsx`:

1. Change line 3 from `import { useMemo, useState } from "react";` to:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
```

2. Directly after the line `const addHistory = useHistoryStore((state) => state.add);` add:

```tsx
  const historyItems = useHistoryStore((state) => state.items);
  const restoredLatestRef = useRef(false);
```

3. Directly after the closing `}` of `function restoreRecord(record: TranslationRecord) { ... }` add:

```tsx

  // Put the newest saved translation back after a refresh, once, and only if
  // the user has not typed or translated anything yet.
  useEffect(() => {
    if (restoredLatestRef.current) return;
    const latest = historyItems[0];
    if (!latest) return;
    restoredLatestRef.current = true;
    if (result !== null || sourceText.trim() !== "") return;
    restoreRecord(latest);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once from the first history snapshot
  }, [historyItems]);
```

- [ ] **Step 5: Lint and type-check**

Run: `npm run lint -w apps/web && npx tsc --noEmit -p apps/web`
Expected: exit 0. If lint reports `react-hooks/set-state-in-effect` on the `restoreRecord(latest)` line, add `// eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of persisted history` directly above it. Do not change the logic.

- [ ] **Step 6: Run the new e2e spec**

Run: `npm run test:e2e -w apps/web -- e2e/persistence.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Run all e2e specs**

Run: `npm run test:e2e -w apps/web`
Expected: PASS for `translate`, `history-phrasebook`, `practice`, `sync-auth`, and `persistence`. If `sync-auth.spec.ts` fails, report the failing assertion and stop; do not edit that spec without review.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/page.tsx apps/web/playwright.config.ts apps/web/e2e/persistence.spec.ts
git commit -m "feat(web): restore the newest translation after refresh"
```

---

### Task 7: Docs, full verification, deploy checklist

**Files:**
- Modify: `docs/neon-setup.md` (new section before `## Troubleshooting`)
- Modify: `context/project.md`

**Interfaces:**
- Consumes: everything above.
- Produces: owner-facing setup notes; no code.

- [ ] **Step 1: Add the anonymous-mode section to the setup doc**

In `docs/neon-setup.md`, insert this immediately before the line `## Troubleshooting`:

```markdown
## 8. Anonymous browser persistence (no sign-in)

The app can keep each browser's history, phrasebook, and practice data in Neon **without Google sign-in**.

- The server sets an httpOnly `myl_anon` cookie the first time that browser saves something. Only a SHA-256 hash of its token is stored (`users.anon_token_hash`, migration `003`).
- On load the page pulls that browser's rows from Neon, merges them with browser storage, and shows the newest translation again. After changes it pushes in the background about 2 seconds later.
- Clearing cookies or opening another browser starts an empty Neon user. Old rows stay in Neon and are not linked.
- With `DATABASE_URL` unset the app stays browser-only and shows no sync errors.

**Render setup for this mode:** apply migrations 001, 002, and 003, then set only `DATABASE_URL` (Neon direct URL, `sslmode=require`). Keep `AUTH_SECRET` and `AUTH_URL` as they are. `NEXT_PUBLIC_GOOGLE_AUTH` and the Google OAuth variables are not needed.

**Verify:** save a phrase, reload, and confirm History, Phrasebook, and the last translation return. In the Neon SQL editor:

```sql
SELECT count(*) FROM users WHERE anon_token_hash IS NOT NULL;
SELECT count(*) FROM phrasebook;
```

---

```

(The closing `---` line separates it from `## Troubleshooting`.)

- [ ] **Step 2: Update the project context**

In `context/project.md`, replace the line

```
- **Current goals:** Deploy Render + Neon when ready; owner uses local translate + `localStorage` until OAuth/Neon configured.
```

with:

```
- **Current goals:** Deploy Render + Neon with anonymous browser persistence (cookie identity, no Google sign-in); local dev still works on `localStorage` alone.
```

- [ ] **Step 3: Run the full automated suite**

Run: `npm test`
Expected: all workspaces PASS (web, shared, dictionary, and the `tsx --test` scripts).

Run: `npm run lint -w apps/web && npx tsc --noEmit -p apps/web`
Expected: exit 0.

- [ ] **Step 4: Confirm health and translate still work without Neon**

Run: `npm run dev -w apps/web` in one terminal (leave `DATABASE_URL` empty), then in another:

```bash
curl -sS -i http://localhost:3000/api/health
curl -sS -i http://localhost:3000/api/history
```

Expected: `/api/health` returns `200` or `503` based only on CEDICT and DeepL (never mentions the database). `/api/history` returns `501` with `{"error":"Cloud sync is not configured"}`. Stop the dev server afterward.

- [ ] **Step 5: Commit**

```bash
git add docs/neon-setup.md context/project.md
git commit -m "docs: document anonymous Neon persistence setup"
```

- [ ] **Step 6: Deploy checklist (owner actions, not automated)**

1. Create or open the Neon project (AWS US West Oregon) and copy the **direct** connection string with `?sslmode=require`.
2. Run migrations 001, 002, 003: GitHub Actions **Neon database migrate** workflow (needs the `DATABASE_URL` repository secret) or `npm run db:migrate` locally.
3. In Render, set `DATABASE_URL` on the `mindyourlanguage` service. Leave `AUTH_*` as they are today.
4. Redeploy.
5. On https://mindyourlanguage-bidm.onrender.com: translate and save a phrase, wait about 3 seconds, reload. Confirm the last translation, History, and Phrasebook return. In Neon, confirm `SELECT count(*) FROM users WHERE anon_token_hash IS NOT NULL;` is at least 1.
6. Open the site in a private window: it should start empty, and a second anonymous row should appear after saving something.
7. Confirm the spec's assumption that `auth()` returns `null` without throwing when Google is not configured: the sync routes should return `200` with `{"items":[]}` for a fresh browser, not `500`.

---

## Self-review against the spec

**Spec coverage**

| Spec section | Task |
|---|---|
| §2 cookie, hash only, resolution order, GET creates nothing, rate-limited creation | Tasks 2, 3 |
| §3 migration 003 and runner | Task 1 |
| §4 server files | Tasks 2, 3 |
| §5 `pullAllStores`, silent 501, mounted component, debounced sync, restore latest | Tasks 4, 5, 6 |
| §5 pull before push | Tasks 4, 5 (`startBackgroundSync` never pushes on load) |
| §8 deploy steps | Task 7 |
| §9 assumptions (`auth()` null, cookie in route handler, rate limiting scope) | Task 7 step 6.7; cookie API checked against `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` (async, `set` supported in route handlers) |
| §10 verification (Vitest, Playwright, manual) | Tasks 1–7 |
| Acceptance 1 (reload restores data and last translation) | Task 6 e2e, Task 7 step 6.5 |
| Acceptance 2 (cookie kept, storage cleared: rows return, nothing deleted) | Task 4 "does not overwrite local data…", Task 7 step 6.5 |
| Acceptance 3 (new browser or cleared cookies starts empty) | Task 2 stale and new cookie tests, Task 7 step 6.6 |
| Acceptance 4 (Neon unset: works, no toast) | Task 4 silent 501 tests, Task 6 first e2e test |
| Acceptance 5 (`/api/health` and translate without Neon) | Task 7 step 4 |

**Placeholders:** none; every code step has full code.

**Type consistency:** `resolveAnonUser` / `AnonResolution` (Task 2) are used by `resolveSyncUser` and all route tests (Task 3). `syncAllStores(options?: SyncOptions)`, `pullAllStores(): Promise<PullResult>`, `isApplyingRemoteState` (Task 4) match the mocks and calls in Task 5. `AuthHeaderActions` still calls `syncAllStores()` with no arguments, which remains valid.
