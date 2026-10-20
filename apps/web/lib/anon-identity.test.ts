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
