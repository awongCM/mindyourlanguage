import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

let overridePath: string | null = null
let cached: Database.Database | null = null
let cachedPath: string | null = null

export function setDictionaryDbPathForTests(dbPath: string | null) {
  overridePath = dbPath
  if (cached) {
    cached.close()
    cached = null
    cachedPath = null
  }
}

export function resolveDictionaryDbPath(): string {
  if (overridePath) return overridePath
  if (process.env.CEDICT_DB_PATH) return path.resolve(process.env.CEDICT_DB_PATH)
  // apps/web cwd -> repo data/; scripts cwd -> repo data/
  const candidates = [
    path.resolve(process.cwd(), 'data/cedict.db'),
    path.resolve(process.cwd(), '../../data/cedict.db'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return candidates[0]
}

export function getDictionaryDb(): Database.Database | null {
  const dbPath = resolveDictionaryDbPath()
  if (!fs.existsSync(dbPath)) return null
  if (cached && cachedPath === dbPath) return cached
  if (cached) cached.close()
  cached = new Database(dbPath, { readonly: true, fileMustExist: true })
  cachedPath = dbPath
  return cached
}
