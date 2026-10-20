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
