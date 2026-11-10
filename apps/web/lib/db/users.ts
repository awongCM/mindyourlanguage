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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function findUserById(userId: string): Promise<string | null> {
  if (!UUID_RE.test(userId)) return null
  const rows = await query<{ id: string }>(
    'SELECT id FROM users WHERE id = $1::uuid LIMIT 1',
    [userId],
  )
  return rows[0]?.id ?? null
}

/** Neon user that already has the most saved phrases (ties: oldest user). */
export async function findPrimaryPhrasebookUserId(): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `SELECT u.id
     FROM users u
     WHERE EXISTS (SELECT 1 FROM phrasebook p WHERE p.user_id = u.id)
     ORDER BY (SELECT count(*)::int FROM phrasebook p WHERE p.user_id = u.id) DESC,
              u.created_at ASC
     LIMIT 1`,
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

export async function findSyncKeyHashByUserId(
  userId: string,
): Promise<string | null> {
  const rows = await query<{ sync_key_hash: string | null }>(
    'SELECT sync_key_hash FROM users WHERE id = $1 LIMIT 1',
    [userId],
  )
  return rows[0]?.sync_key_hash ?? null
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
