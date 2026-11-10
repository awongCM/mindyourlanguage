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

/** When set on the server, every browser uses the same Neon phrasebook (no login). */
export function sharedAnonTokenFromEnv(): string | null {
  const value = process.env.MYL_SHARED_ANON_TOKEN?.trim()
  return value ? value : null
}

async function setAnonCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(ANON_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ANON_COOKIE_MAX_AGE_SECONDS,
  })
}

async function resolveKnownAnonToken(
  token: string,
): Promise<{ kind: 'user'; userId: string } | null> {
  const userId = await findUserIdByAnonTokenHash(hashAnonToken(token))
  if (!userId) return null
  await setAnonCookie(token)
  return { kind: 'user', userId }
}

/**
 * Resolve the anonymous user for this request's cookie.
 * Reads never create a user. With `create: true`, a missing or stale cookie
 * creates a user and sets a new httpOnly cookie (route handlers only).
 *
 * When `MYL_SHARED_ANON_TOKEN` is set, a browser with no matching cookie
 * adopts that token so Safari and Chrome load the same persisted rows.
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

  const shared = sharedAnonTokenFromEnv()
  if (shared) {
    const resolved = await resolveKnownAnonToken(shared)
    if (resolved) return resolved
    if (!options.create) return { kind: 'none' }

    const requestHeaders = await headers()
    const ip = clientIpFromForwardedFor(requestHeaders.get('x-forwarded-for'))
    if (!checkRateLimitForKey(`anon-create:${ip}`)) {
      return { kind: 'rate_limited' }
    }

    const userId = await createAnonUser(hashAnonToken(shared))
    await setAnonCookie(shared)
    return { kind: 'user', userId }
  }

  if (!options.create) return { kind: 'none' }

  const requestHeaders = await headers()
  const ip = clientIpFromForwardedFor(requestHeaders.get('x-forwarded-for'))
  if (!checkRateLimitForKey(`anon-create:${ip}`)) {
    return { kind: 'rate_limited' }
  }

  const newToken = generateAnonToken()
  const userId = await createAnonUser(hashAnonToken(newToken))
  await setAnonCookie(newToken)
  return { kind: 'user', userId }
}
