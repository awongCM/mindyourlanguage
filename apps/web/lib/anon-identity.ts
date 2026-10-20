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
