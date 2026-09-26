import { Pool, type QueryResultRow } from 'pg'

let pool: Pool | null = null

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export function getPool(): Pool | null {
  if (!isDatabaseConfigured()) return null
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return pool
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const p = getPool()
  if (!p) throw new Error('DATABASE_URL is not configured')
  const result = await p.query<T>(text, params)
  return result.rows
}

/** @internal Reset pool between tests */
export function resetPoolForTests(): void {
  pool = null
}
