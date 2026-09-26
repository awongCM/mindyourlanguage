import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { resolveDatabaseUrl } from './run-migrations'

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
