import { createHash, randomBytes } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import {
  createAnonUser,
  findPrimaryPhrasebookUserId,
  findUserById,
  findUserIdByAnonTokenHash,
} from '@/lib/db/users'
import {
  checkRateLimitForKey,
  clientIpFromForwardedFor,
} from '@/lib/rate-limit'

export const ANON_COOKIE = 'myl_anon'
export const ANON_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60
export const PRIMARY_ANON_COOKIE_PREFIX = 'myl-primary:'

export type AnonResolution =
  | { kind: 'user'; userId: string }
  | { kind: 'none' }
  | { kind: 'rate_limited' }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

/**
 * Default on: bind every browser to one Neon phrasebook when data already exists.
 * Set `MYL_AUTO_PRIMARY_PHRASEBOOK=false` on multi-tenant deployments.
 */
export function autoPrimaryPhrasebookEnabled(): boolean {
  const raw = process.env.MYL_AUTO_PRIMARY_PHRASEBOOK?.trim().toLowerCase()
  if (raw === 'false' || raw === '0' || raw === 'no') return false
  return true
}

export function primaryAnonCookieValue(userId: string): string {
  return `${PRIMARY_ANON_COOKIE_PREFIX}${userId}`
}

export function fixedPhrasebookUserIdFromEnv(): string | null {
  const value = process.env.MYL_FIXED_PHRASEBOOK_USER_ID?.trim()
  if (!value || !UUID_RE.test(value)) return null
  return value
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

/** Map an httpOnly cookie value to a Neon user id, or null when it does not match. */
export async function resolveUserIdFromAnonCookie(
  value: string,
): Promise<string | null> {
  if (value.startsWith(PRIMARY_ANON_COOKIE_PREFIX)) {
    const userId = value.slice(PRIMARY_ANON_COOKIE_PREFIX.length)
    return findUserById(userId)
  }
  return findUserIdByAnonTokenHash(hashAnonToken(value))
}

async function resolveKnownAnonToken(
  token: string,
): Promise<{ kind: 'user'; userId: string } | null> {
  const userId = await findUserIdByAnonTokenHash(hashAnonToken(token))
  if (!userId) return null
  await setAnonCookie(token)
  return { kind: 'user', userId }
}

async function resolveConfiguredPrimaryUserId(): Promise<string | null> {
  const fixed = fixedPhrasebookUserIdFromEnv()
  if (fixed) {
    const userId = await findUserById(fixed)
    if (userId) return userId
  }
  return findPrimaryPhrasebookUserId()
}

async function adoptPrimaryPhrasebookUser(
  userId: string,
): Promise<AnonResolution> {
  await setAnonCookie(primaryAnonCookieValue(userId))
  return { kind: 'user', userId }
}

/**
 * Resolve the anonymous user for this request's cookie.
 * Reads never create a user. With `create: true`, a missing or stale cookie
 * creates a user and sets a new httpOnly cookie (route handlers only).
 *
 * When phrasebook data already exists, auto-primary mode rebinds Safari, Brave,
 * and other browsers to that Neon user (no manual token or sync phrase).
 */
export async function resolveAnonUser(options: {
  create: boolean
}): Promise<AnonResolution> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ANON_COOKIE)?.value

  if (autoPrimaryPhrasebookEnabled()) {
    const primaryId = await resolveConfiguredPrimaryUserId()
    if (primaryId) {
      if (token) {
        const currentId = await resolveUserIdFromAnonCookie(token)
        if (currentId === primaryId) {
          return { kind: 'user', userId: primaryId }
        }
      }
      return adoptPrimaryPhrasebookUser(primaryId)
    }
  }

  if (token) {
    const existing = await resolveUserIdFromAnonCookie(token)
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
