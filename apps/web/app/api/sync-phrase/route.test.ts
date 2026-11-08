import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ANON_COOKIE } from '@/lib/anon-identity'
import { resolveSyncUser } from '@/lib/auth-session'
import {
  findUserIdByAnonTokenHash,
  findUserIdBySyncKeyHash,
  setUserSyncKeyHash,
} from '@/lib/db/users'
import { checkRateLimitForKey } from '@/lib/rate-limit'
import {
  SYNC_PHRASE_COOKIE,
  decodeSyncPhraseCookie,
  encodeSyncPhraseCookie,
  hashSyncPhrase,
  normalizeSyncPhrase,
} from '@/lib/sync-phrase'
import { GET, POST } from './route'

const cookieJar = vi.hoisted(() => new Map<string, string>())
const cookieStore = vi.hoisted(() => ({
  get: vi.fn((name: string) => {
    const value = cookieJar.get(name)
    return value ? { value } : undefined
  }),
  set: vi.fn((name: string, value: string) => {
    cookieJar.set(name, value)
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
  setUserSyncKeyHash: vi.fn(),
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
  it('normalizes surrounding space and rejects a short phrase', () => {
    expect(normalizeSyncPhrase('  river lantern  ')).toBe('river lantern')
    expect(normalizeSyncPhrase('short')).toBeNull()
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
    vi.mocked(findUserIdBySyncKeyHash).mockReset()
    vi.mocked(setUserSyncKeyHash).mockReset()
    vi.mocked(checkRateLimitForKey).mockReset()
    vi.mocked(checkRateLimitForKey).mockReturnValue(true)
    vi.mocked(findUserIdBySyncKeyHash).mockResolvedValue(null)
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
    expect(setUserSyncKeyHash).not.toHaveBeenCalled()
    expect(cookieStore.set).not.toHaveBeenCalled()
  })

  it('returns 429 when attempts are rate limited', async () => {
    vi.mocked(checkRateLimitForKey).mockReturnValue(false)

    const res = await POST(post({ phrase, action: 'open' }) as never)
    expect(res.status).toBe(429)
    expect(findUserIdBySyncKeyHash).not.toHaveBeenCalled()
  })

  it('save stores the hash on the current browser user and sets the cookie', async () => {
    cookieJar.set(ANON_COOKIE, 'anon-tok')
    vi.mocked(findUserIdByAnonTokenHash).mockResolvedValue('user-chrome')
    vi.mocked(setUserSyncKeyHash).mockResolvedValue('ok')

    const res = await POST(post({ phrase, action: 'save' }) as never)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ linked: true })
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
