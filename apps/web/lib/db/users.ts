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
