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

export async function findUserIdBySyncKeyHash(
  syncKeyHash: string,
): Promise<string | null> {
  const rows = await query<{ id: string }>(
    'SELECT id FROM users WHERE sync_key_hash = $1 LIMIT 1',
    [syncKeyHash],
  )
  return rows[0]?.id ?? null
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}

/** Attach a sync phrase hash to this user. `taken` when another user already has it. */
export async function setUserSyncKeyHash(
  userId: string,
  syncKeyHash: string,
): Promise<'ok' | 'taken' | 'missing'> {
  try {
    const rows = await query<{ id: string }>(
      'UPDATE users SET sync_key_hash = $1 WHERE id = $2 RETURNING id',
      [syncKeyHash, userId],
    )
    return rows[0] ? 'ok' : 'missing'
  } catch (error) {
    if (isUniqueViolation(error)) return 'taken'
    throw error
  }
}
