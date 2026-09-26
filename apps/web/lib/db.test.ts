import { afterEach, describe, expect, it } from 'vitest'
import { isDatabaseConfigured, resetPoolForTests } from './db'

describe('isDatabaseConfigured', () => {
  const original = process.env.DATABASE_URL

  afterEach(() => {
    resetPoolForTests()
    if (original === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = original
  })

  it('returns false when DATABASE_URL is empty', () => {
    delete process.env.DATABASE_URL
    expect(isDatabaseConfigured()).toBe(false)
  })

  it('returns true when DATABASE_URL is set', () => {
    process.env.DATABASE_URL =
      'postgresql://user:pass@host/db?sslmode=require'
    expect(isDatabaseConfigured()).toBe(true)
  })
})
