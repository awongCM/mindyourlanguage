import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ANON_COOKIE } from '@/lib/anon-identity'
import { resolveSyncUser } from '@/lib/auth-session'
import {
  createAnonUser,
  findSyncKeyHashByUserId,
  findUserIdByAnonTokenHash,
  findUserIdBySyncKeyHash,
  setUserSyncKeyHash,
} from '@/lib/db/users'
import { upsertHistory } from '@/lib/db/history'
import { upsertPhrasebook } from '@/lib/db/phrasebook'
import { appendReviewEvents } from '@/lib/db/review-events'
import { checkRateLimitForKey } from '@/lib/rate-limit'
import {
  SYNC_PHRASE_COOKIE,
  decodeSyncPhraseCookie,
  encodeSyncPhraseCookie,
  hashSyncPhrase,
  normalizeSyncPhrase,
  parseSyncPhrase,
  resetSyncPhraseFailuresForTests,
} from '@/lib/sync-phrase'
import { GET, POST } from './route'

const cookieJar = vi.hoisted(() => new Map<string, string>())
const cookieStore = vi.hoisted(() => ({
  get: vi.fn((name: string) => {
    const value = cookieJar.get(name)
    return value ? { value } : undefined
  }),
  set: vi.fn((name: string, value: string, options?: { maxAge?: number }) => {
    if (options?.maxAge === 0) cookieJar.delete(name)
    else cookieJar.set(name, value)
  }),
}))
const headerStore = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
  headers: vi.fn(async () => headerStore),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => null),
}))

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: vi.fn(() => true),
}))

vi.mock('@/lib/db/users', () => ({
  findUserIdByAnonTokenHash: vi.fn(),
  createAnonUser: vi.fn(),
  findUserIdBySyncKeyHash: vi.fn(),
  findSyncKeyHashByUserId: vi.fn(),
  setUserSyncKeyHash: vi.fn(),
}))

vi.mock('@/lib/db/phrasebook', () => ({
  upsertPhrasebook: vi.fn(),
}))

vi.mock('@/lib/db/history', () => ({
  upsertHistory: vi.fn(),
}))

vi.mock('@/lib/db/review-events', () => ({
  appendReviewEvents: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitForKey: vi.fn(() => true),
  clientIpFromForwardedFor: vi.fn(() => '203.0.113.9'),
}))

const phrase = 'river lantern'
const phraseHash = hashSyncPhrase(phrase)

function post(body: unknown) {
  return new Request('http://localhost/api/sync-phrase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('sync phrase helpers', () => {
  it('folds case, collapses spaces, and rejects a short or one-word phrase', () => {
    expect(normalizeSyncPhrase('  River   Lantern  ')).toBe('river lantern')
    expect(parseSyncPhrase('River Lantern')).toEqual({
      ok: true,
      phrase: 'river lantern',
    })
    expect(parseSyncPhrase('short')).toMatchObject({ ok: false })
    expect(parseSyncPhrase('password')).toMatchObject({ ok: false })
    expect(parseSyncPhrase('x'.repeat(81))).toMatchObject({
      ok: false,
      error: 'Use at most 80 characters.',
    })
  })

  it('hashes a prefixed digest that is not the phrase', () => {
    expect(phraseHash).toMatch(/^[0-9a-f]{64}$/)
    expect(phraseHash).not.toBe(phrase)
    expect(decodeSyncPhraseCookie(encodeSyncPhraseCookie(phrase))).toBe(phrase)
  })
})

describe('/api/sync-phrase', () => {
  beforeEach(() => {
    cookieJar.clear()
    cookieStore.get.mockClear()
    cookieStore.set.mockClear()
    headerStore.get.mockReset()
    vi.mocked(findUserIdByAnonTokenHash).mockReset()
    vi.mocked(createAnonUser).mockReset()
    vi.mocked(findUserIdBySyncKeyHash).mockReset()
    vi.mocked(findSyncKeyHashByUserId).mockReset()
    vi.mocked(findSyncKeyHashByUserId).mockResolvedValue(null)
    vi.mocked(setUserSyncKeyHash).mockReset()
    resetSyncPhraseFailuresForTests()
    vi.mocked(checkRateLimitForKey).mockReset()
    vi.mocked(checkRateLimitForKey).mockReturnValue(true)
    vi.mocked(findUserIdBySyncKeyHash).mockResolvedValue(null)
    vi.mocked(upsertPhrasebook).mockReset()
    vi.mocked(upsertHistory).mockReset()
    vi.mocked(appendReviewEvents).mockReset()
    vi.mocked(upsertPhrasebook).mockResolvedValue([])
    vi.mocked(upsertHistory).mockResolvedValue([])
    vi.mocked(appendReviewEvents).mockResolvedValue([])
  })

  it('GET reports linked only when the sync phrase cookie matches a user', async () => {
    const unlinked = await GET()
    expect(unlinked.status).toBe(200)
    await expect(unlinked.json()).resolves.toEqual({ linked: false })

    cookieJar.set(SYNC_PHRASE_COOKIE, encodeSyncPhraseCookie(phrase))
    vi.mocked(findUserIdBySyncKeyHash).mockResolvedValue('user-shared')

    const linked = await GET()
    await expect(linked.json()).resolves.toEqual({ linked: true })
  })

  it('rejects a short phrase before creating a user', async () => {
    const res = await POST(post({ phrase: 'short', action: 'save' }) as never)
    expect(res.status).toBe(400)
    expect(createAnonUser).not.toHaveBeenCalled()
    expect(setUserSyncKeyHash).not.toHaveBeenCalled()
    expect(cookieStore.set).not.toHaveBeenCalled()
  })

  it('save with no browser identity does not create a user or set a cookie', async () => {
    const res = await POST(post({ phrase, action: 'save' }) as never)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: 'Save the phrase in the browser that already shows your phrases.',
    })
    expect(createAnonUser).not.toHaveBeenCalled()
    expect(setUserSyncKeyHash).not.toHaveBeenCalled()
    expect(cookieJar.has(SYNC_PHRASE_COOKIE)).toBe(false)
    expect(cookieJar.has(ANON_COOKIE)).toBe(false)
  })

  it('returns 429 when attempts are rate limited', async () => {
    vi.mocked(checkRateLimitForKey).mockReturnValue(false)

    const res = await POST(post({ phrase, action: 'open' }) as never)
    expect(res.status).toBe(429)
    expect(findUserIdBySyncKeyHash).not.toHaveBeenCalled()
  })

  it('save with the phrases on screen stores them, then links the phrase, even with no cookie', async () => {
    const entry = { id: '11111111-1111-4111-8111-111111111111', sourceText: 'Hello' }
    vi.mocked(createAnonUser).mockResolvedValue('user-new')
    vi.mocked(setUserSyncKeyHash).mockResolvedValue('ok')

    const res = await POST(
      post({
        phrase,
        action: 'save',
        phrasebook: [entry],
        history: [{ id: '22222222-2222-4222-8222-222222222222' }],
        events: [{ id: '33333333-3333-4333-8333-333333333333' }],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(createAnonUser).toHaveBeenCalledOnce()
    expect(upsertPhrasebook).toHaveBeenCalledWith('user-new', [entry], [])
    expect(upsertHistory).toHaveBeenCalledWith(
      'user-new',
      [{ id: '22222222-2222-4222-8222-222222222222' }],
      [],
    )
    expect(appendReviewEvents).toHaveBeenCalledWith('user-new', [
      { id: '33333333-3333-4333-8333-333333333333' },
    ])
    expect(setUserSyncKeyHash).toHaveBeenCalledWith('user-new', phraseHash)
    expect(cookieJar.get(SYNC_PHRASE_COOKIE)).toBe(encodeSyncPhraseCookie(phrase))
    expect(cookieJar.has(ANON_COOKIE)).toBe(true)
  })

  it('save with phrases still refuses a phrase another phrasebook already uses', async () => {
    vi.mocked(findUserIdBySyncKeyHash).mockResolvedValue('user-other')

    const res = await POST(
      post({
        phrase,
        action: 'save',
        phrasebook: [{ id: '11111111-1111-4111-8111-111111111111' }],
      }) as never,
    )

    expect(res.status).toBe(409)
    expect(createAnonUser).not.toHaveBeenCalled()
    expect(upsertPhrasebook).not.toHaveBeenCalled()
    expect(setUserSyncKeyHash).not.toHaveBeenCalled()
  })

  it('save stores the phrases this browser is showing on its existing user', async () => {
    const entry = { id: '11111111-1111-4111-8111-111111111111', sourceText: 'Hello' }
    cookieJar.set(ANON_COOKIE, 'anon-tok')
    vi.mocked(findUserIdByAnonTokenHash).mockResolvedValue('user-chrome')
    vi.mocked(setUserSyncKeyHash).mockResolvedValue('ok')

    const res = await POST(
      post({ phrase, action: 'save', phrasebook: [entry] }) as never,
    )

    expect(res.status).toBe(200)
    expect(createAnonUser).not.toHaveBeenCalled()
    expect(upsertPhrasebook).toHaveBeenCalledWith('user-chrome', [entry], [])
    expect(setUserSyncKeyHash).toHaveBeenCalledWith('user-chrome', phraseHash)
  })

  it('save stores the hash on the current browser user and sets the cookie', async () => {
    cookieJar.set(ANON_COOKIE, 'anon-tok')
    vi.mocked(findUserIdByAnonTokenHash).mockResolvedValue('user-chrome')
    vi.mocked(setUserSyncKeyHash).mockResolvedValue('ok')

    const res = await POST(post({ phrase, action: 'save' }) as never)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ linked: true, replaced: false })
    expect(setUserSyncKeyHash).toHaveBeenCalledWith('user-chrome', phraseHash)
    expect(cookieJar.get(SYNC_PHRASE_COOKIE)).toBe(encodeSyncPhraseCookie(phrase))
  })

  it('save refuses a phrase another user already saved', async () => {
    cookieJar.set(ANON_COOKIE, 'anon-tok')
    vi.mocked(findUserIdByAnonTokenHash).mockResolvedValue('user-chrome')
    vi.mocked(findUserIdBySyncKeyHash).mockResolvedValue('user-other')

    const res = await POST(post({ phrase, action: 'save' }) as never)
    expect(res.status).toBe(409)
    expect(setUserSyncKeyHash).not.toHaveBeenCalled()
    expect(cookieJar.has(SYNC_PHRASE_COOKIE)).toBe(false)
  })

  it('open sets the cookie for the existing user and does not create one', async () => {
    vi.mocked(findUserIdBySyncKeyHash).mockResolvedValue('user-chrome')

    const res = await POST(post({ phrase, action: 'open' }) as never)
    expect(res.status).toBe(200)
    expect(setUserSyncKeyHash).not.toHaveBeenCalled()
    expect(cookieJar.get(SYNC_PHRASE_COOKIE)).toBe(encodeSyncPhraseCookie(phrase))
  })

  it('open reports when no phrasebook uses the phrase', async () => {
    const res = await POST(post({ phrase, action: 'open' }) as never)
    expect(res.status).toBe(404)
    expect(cookieStore.set).not.toHaveBeenCalled()
  })

  it('save returns 409 and sets no cookie when the unique index rejects the hash', async () => {
    cookieJar.set(ANON_COOKIE, 'anon-tok')
    vi.mocked(findUserIdByAnonTokenHash).mockResolvedValue('user-chrome')
    vi.mocked(setUserSyncKeyHash).mockResolvedValue('taken')

    const res = await POST(post({ phrase, action: 'save' }) as never)
    expect(res.status).toBe(409)
    expect(cookieJar.has(SYNC_PHRASE_COOKIE)).toBe(false)
  })

  it('save cannot replace a phrase this browser does not hold', async () => {
    cookieJar.set(ANON_COOKIE, 'anon-tok')
    vi.mocked(findUserIdByAnonTokenHash).mockResolvedValue('user-chrome')
    vi.mocked(findSyncKeyHashByUserId).mockResolvedValue('existing-hash')

    const res = await POST(post({ phrase, action: 'save' }) as never)
    expect(res.status).toBe(409)
    expect(setUserSyncKeyHash).not.toHaveBeenCalled()
    expect(cookieJar.has(SYNC_PHRASE_COOKIE)).toBe(false)
  })

  it('forget clears only the sync phrase cookie', async () => {
    cookieJar.set(ANON_COOKIE, 'anon-tok')
    cookieJar.set(SYNC_PHRASE_COOKIE, encodeSyncPhraseCookie(phrase))

    const res = await POST(post({ action: 'forget' }) as never)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ linked: false })
    expect(cookieJar.has(SYNC_PHRASE_COOKIE)).toBe(false)
    expect(cookieJar.get(ANON_COOKIE)).toBe('anon-tok')
  })

  it('stops guessing one phrase after repeated misses', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await POST(post({ phrase, action: 'open' }) as never)
      expect(res.status).toBe(404)
    }

    const blocked = await POST(post({ phrase, action: 'open' }) as never)
    expect(blocked.status).toBe(429)
  })

  it('rates limits using Cloudflare’s client IP when it is present', async () => {
    headerStore.get.mockImplementation((name: string) =>
      name === 'cf-connecting-ip' ? '198.51.100.8' : null,
    )

    await POST(post({ phrase, action: 'open' }) as never)
    expect(checkRateLimitForKey).toHaveBeenCalledWith('sync-phrase:198.51.100.8')
  })

  it('prefers the sync phrase over this browser’s anonymous cookie', async () => {
    cookieJar.set(ANON_COOKIE, 'anon-tok')
    cookieJar.set(SYNC_PHRASE_COOKIE, encodeSyncPhraseCookie(phrase))
    vi.mocked(findUserIdByAnonTokenHash).mockResolvedValue('user-empty')
    vi.mocked(findUserIdBySyncKeyHash).mockResolvedValue('user-chrome')

    await expect(resolveSyncUser({ create: false })).resolves.toEqual({
      kind: 'user',
      userId: 'user-chrome',
    })
    expect(findUserIdByAnonTokenHash).not.toHaveBeenCalled()
  })
})
