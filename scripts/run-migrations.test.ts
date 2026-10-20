import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { MIGRATION_FILES, resolveDatabaseUrl } from './run-migrations'

describe('resolveDatabaseUrl', () => {
  const original = process.env.DATABASE_URL

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = original
  })

  it('prefers process.env.DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgresql://from-env'
    assert.equal(resolveDatabaseUrl(), 'postgresql://from-env')
  })
})

describe('MIGRATION_FILES', () => {
  it('lists every SQL file in db/migrations in order', () => {
    const dir = path.resolve(__dirname, '../db/migrations')
    const onDisk = fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.sql'))
      .sort()
    assert.deepEqual([...MIGRATION_FILES], onDisk)
  })
})
