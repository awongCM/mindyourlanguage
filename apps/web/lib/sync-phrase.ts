import { createHash } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { ANON_COOKIE_MAX_AGE_SECONDS } from '@/lib/anon-identity'
import {
  findSyncKeyHashByUserId,
  findUserIdBySyncKeyHash,
  setUserSyncKeyHash,
} from '@/lib/db/users'
import {
  checkRateLimitForKey,
  clientIpFromForwardedFor,
} from '@/lib/rate-limit'

export const SYNC_PHRASE_COOKIE = 'myl_sync'
export const SYNC_PHRASE_MIN_LENGTH = 12
export const SYNC_PHRASE_MAX_LENGTH = 80
const PHRASE_FAILURE_LIMIT = 5
const PHRASE_FAILURE_WINDOW_MS = 10 * 60 * 1000

export type SyncPhraseFailure = {
  ok: false
  status: 400 | 404 | 409 | 429 | 503
  error: string
}

export type SyncPhraseSuccess = { ok: true; replaced?: boolean }

const PHRASE_TOO_SHORT =
  'Use at least two words and 12 characters. Pick something other people would not guess.'
const PHRASE_TOO_LONG = 'Use at most 80 characters.'
const PHRASE_UNKNOWN =
  'No phrasebook uses that phrase yet. Save it in the browser that already shows your phrases.'
export const PHRASE_TAKEN =
  'That phrase already belongs to another phrasebook. Pick a different phrase in the browser that shows your phrases.'
const PHRASE_REPLACE_BLOCKED =
  'This browser does not hold the current sync phrase, so it cannot replace it.'
export const TOO_MANY = 'Too many attempts. Wait a moment.'

const phraseFailures = new Map<string, number[]>()

/** Fold case and collapse whitespace so two browsers can type the same words. */
export function normalizeSyncPhrase(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function parseSyncPhrase(
  raw: string,
): { ok: true; phrase: string } | { ok: false; error: string } {
  const phrase = normalizeSyncPhrase(raw)
  if (phrase.length > SYNC_PHRASE_MAX_LENGTH) {
    return { ok: false, error: PHRASE_TOO_LONG }
  }
  if (phrase.length < SYNC_PHRASE_MIN_LENGTH || !phrase.includes(' ')) {
    return { ok: false, error: PHRASE_TOO_SHORT }
  }
  return { ok: true, phrase }
}

export function resetSyncPhraseFailuresForTests(): void {
  phraseFailures.clear()
}

function phraseFailureBlocked(phrase: string, now = Date.now()): boolean {
  const stamps = (phraseFailures.get(phrase) ?? []).filter(
    (stamp) => now - stamp < PHRASE_FAILURE_WINDOW_MS,
  )
  phraseFailures.set(phrase, stamps)
  return stamps.length >= PHRASE_FAILURE_LIMIT
}

function notePhraseFailure(phrase: string, now = Date.now()): void {
  const stamps = (phraseFailures.get(phrase) ?? []).filter(
    (stamp) => now - stamp < PHRASE_FAILURE_WINDOW_MS,
  )
  stamps.push(now)
  phraseFailures.set(phrase, stamps)
}

export function hashSyncPhrase(phrase: string): string {
  return createHash('sha256').update(`sync-phrase\0${phrase}`).digest('hex')
}

export function encodeSyncPhraseCookie(phrase: string): string {
  return Buffer.from(phrase, 'utf8').toString('base64url')
}

export function decodeSyncPhraseCookie(value: string): string | null {
  try {
    const parsed = parseSyncPhrase(
      Buffer.from(value, 'base64url').toString('utf8'),
    )
    return parsed.ok ? parsed.phrase : null
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

function clientIp(requestHeaders: {
  get(name: string): string | null
}): string {
  const cloudflare = requestHeaders.get('cf-connecting-ip')?.trim()
  if (cloudflare) return cloudflare
  return clientIpFromForwardedFor(requestHeaders.get('x-forwarded-for'))
}

async function allowAttempt(): Promise<boolean> {
  const requestHeaders = await headers()
  return checkRateLimitForKey(`sync-phrase:${clientIp(requestHeaders)}`)
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

  const parsed = parseSyncPhrase(rawPhrase)
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error }
  return { ok: true, phrase: parsed.phrase }
}

/**
 * Point this browser at the Neon user that already saved `phrase`.
 * Does not create a user. `phrase` must already be normalized.
 */
export async function openPreparedSyncPhrase(
  phrase: string,
): Promise<SyncPhraseSuccess | SyncPhraseFailure> {
  if (phraseFailureBlocked(phrase)) {
    return { ok: false, status: 429, error: TOO_MANY }
  }

  const userId = await findUserIdBySyncKeyHash(hashSyncPhrase(phrase))
  if (!userId) {
    notePhraseFailure(phrase)
    return { ok: false, status: 404, error: PHRASE_UNKNOWN }
  }

  await rememberPhrase(phrase)
  return { ok: true }
}

/** Drop myl_sync so this browser falls back to its own myl_anon cookie. */
export async function forgetSyncPhrase(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SYNC_PHRASE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
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

  const currentHash = await findSyncKeyHashByUserId(userId)
  const cookiePhrase = await readPhraseFromCookie()
  const holdsCurrent =
    currentHash !== null &&
    cookiePhrase !== null &&
    hashSyncPhrase(cookiePhrase) === currentHash
  if (currentHash && currentHash !== hash && !holdsCurrent) {
    return { ok: false, status: 409, error: PHRASE_REPLACE_BLOCKED }
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
  return { ok: true, replaced: Boolean(currentHash && currentHash !== hash) }
}
