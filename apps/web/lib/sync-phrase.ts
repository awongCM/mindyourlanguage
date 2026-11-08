import { createHash } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { ANON_COOKIE_MAX_AGE_SECONDS } from '@/lib/anon-identity'
import {
  findUserIdBySyncKeyHash,
  setUserSyncKeyHash,
} from '@/lib/db/users'
import {
  checkRateLimitForKey,
  clientIpFromForwardedFor,
} from '@/lib/rate-limit'

export const SYNC_PHRASE_COOKIE = 'myl_sync'
export const SYNC_PHRASE_MIN_LENGTH = 8
export const SYNC_PHRASE_MAX_LENGTH = 80

export type SyncPhraseFailure = {
  ok: false
  status: 400 | 404 | 409 | 429 | 503
  error: string
}

export type SyncPhraseSuccess = { ok: true }

const PHRASE_TOO_SHORT = `Use a sync phrase of at least ${SYNC_PHRASE_MIN_LENGTH} characters.`
const PHRASE_UNKNOWN =
  'No phrasebook uses that phrase yet. Save it in the browser that already shows your phrases.'
const PHRASE_TAKEN =
  'That phrase already belongs to another phrasebook. Choose Open phrase instead.'
const TOO_MANY = 'Too many attempts. Wait a moment.'

/** Trim and normalize. Null when the phrase is too short, too long, or has a line break. */
export function normalizeSyncPhrase(raw: string): string | null {
  const phrase = raw.normalize('NFC').trim()
  if (
    phrase.length < SYNC_PHRASE_MIN_LENGTH ||
    phrase.length > SYNC_PHRASE_MAX_LENGTH
  ) {
    return null
  }
  if (/[\r\n]/.test(phrase)) return null
  return phrase
}

export function hashSyncPhrase(phrase: string): string {
  return createHash('sha256').update(`sync-phrase\0${phrase}`).digest('hex')
}

export function encodeSyncPhraseCookie(phrase: string): string {
  return Buffer.from(phrase, 'utf8').toString('base64url')
}

export function decodeSyncPhraseCookie(value: string): string | null {
  try {
    return normalizeSyncPhrase(Buffer.from(value, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

async function readPhraseFromCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(SYNC_PHRASE_COOKIE)?.value
  if (!value) return null
  return decodeSyncPhraseCookie(value)
}

/** User id for the myl_sync cookie, or null when this browser has not opened one. */
export async function findUserIdFromSyncPhraseCookie(): Promise<string | null> {
  const phrase = await readPhraseFromCookie()
  if (!phrase) return null
  return findUserIdBySyncKeyHash(hashSyncPhrase(phrase))
}

async function allowAttempt(): Promise<boolean> {
  const requestHeaders = await headers()
  const ip = clientIpFromForwardedFor(requestHeaders.get('x-forwarded-for'))
  return checkRateLimitForKey(`sync-phrase:${ip}`)
}

async function rememberPhrase(phrase: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SYNC_PHRASE_COOKIE, encodeSyncPhraseCookie(phrase), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ANON_COOKIE_MAX_AGE_SECONDS,
  })
}

/** Rate-limit and validate before any user row is created. */
export async function beginSyncPhraseAttempt(
  rawPhrase: string,
): Promise<{ ok: true; phrase: string } | SyncPhraseFailure> {
  if (!(await allowAttempt())) {
    return { ok: false, status: 429, error: TOO_MANY }
  }

  const phrase = normalizeSyncPhrase(rawPhrase)
  if (!phrase) return { ok: false, status: 400, error: PHRASE_TOO_SHORT }
  return { ok: true, phrase }
}

/**
 * Point this browser at the Neon user that already saved `phrase`.
 * Does not create a user. `phrase` must already be normalized.
 */
export async function openPreparedSyncPhrase(
  phrase: string,
): Promise<SyncPhraseSuccess | SyncPhraseFailure> {
  const userId = await findUserIdBySyncKeyHash(hashSyncPhrase(phrase))
  if (!userId) return { ok: false, status: 404, error: PHRASE_UNKNOWN }

  await rememberPhrase(phrase)
  return { ok: true }
}

/**
 * Save a normalized `phrase` on the user this browser already syncs.
 * Other browsers can then open that same phrase.
 */
export async function savePreparedSyncPhrase(
  userId: string,
  phrase: string,
): Promise<SyncPhraseSuccess | SyncPhraseFailure> {
  const hash = hashSyncPhrase(phrase)
  const ownerId = await findUserIdBySyncKeyHash(hash)
  if (ownerId && ownerId !== userId) {
    return { ok: false, status: 409, error: PHRASE_TAKEN }
  }

  if (ownerId !== userId) {
    const saved = await setUserSyncKeyHash(userId, hash)
    if (saved === 'taken') {
      return { ok: false, status: 409, error: PHRASE_TAKEN }
    }
    if (saved === 'missing') {
      return { ok: false, status: 503, error: 'Database error' }
    }
  }

  await rememberPhrase(phrase)
  return { ok: true }
}
