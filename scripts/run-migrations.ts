import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const ROOT = path.resolve(__dirname, '..')
const MIGRATION_FILES = ['001_initial.sql', '002_cloud_sync.sql'] as const

function parseEnvValue(raw: string): string {
  const trimmed = raw.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim()
  if (fromEnv) return fromEnv

  const envLocal = path.join(ROOT, 'apps/web/.env.local')
  if (!fs.existsSync(envLocal)) {
    throw new Error(
      'DATABASE_URL is not set. Export it or add DATABASE_URL=… to apps/web/.env.local',
    )
  }

  for (const line of fs.readFileSync(envLocal, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (trimmed.startsWith('DATABASE_URL=')) {
      const value = parseEnvValue(trimmed.slice('DATABASE_URL='.length))
      if (value) return value
    }
  }

  throw new Error(
    'DATABASE_URL is not set. Export it or add DATABASE_URL=… to apps/web/.env.local',
  )
}

async function main(): Promise<void> {
  const connectionString = resolveDatabaseUrl()
  const client = new pg.Client({ connectionString })

  await client.connect()
  try {
    for (const file of MIGRATION_FILES) {
      const filePath = path.join(ROOT, 'db/migrations', file)
      const sql = fs.readFileSync(filePath, 'utf8')
      console.log(`Applying ${file}…`)
      await client.query(sql)
      console.log(`Applied ${file}`)
    }
    console.log('All migrations applied.')
  } finally {
    await client.end()
  }
}

const invokedDirectly = process.argv[1]?.endsWith(`${path.sep}run-migrations.ts`)
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
