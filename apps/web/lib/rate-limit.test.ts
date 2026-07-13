import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('checkRateLimit', () => {
  const originalEnv = process.env.RATE_LIMIT_PER_MIN

  beforeEach(() => {
    vi.resetModules()
    delete process.env.RATE_LIMIT_PER_MIN
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RATE_LIMIT_PER_MIN
    } else {
      process.env.RATE_LIMIT_PER_MIN = originalEnv
    }
  })

  it('allows requests under the default limit of 20/min', async () => {
    const { checkRateLimit } = await import('./rate-limit')
    const ip = '1.2.3.4'
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit(ip)).toBe(true)
    }
  })

  it('returns false when over the default limit', async () => {
    const { checkRateLimit } = await import('./rate-limit')
    const ip = '5.6.7.8'
    for (let i = 0; i < 20; i++) {
      checkRateLimit(ip)
    }
    expect(checkRateLimit(ip)).toBe(false)
  })

  it('uses RATE_LIMIT_PER_MIN env when set', async () => {
    process.env.RATE_LIMIT_PER_MIN = '2'
    const { checkRateLimit } = await import('./rate-limit')
    const ip = '9.9.9.9'
    expect(checkRateLimit(ip)).toBe(true)
    expect(checkRateLimit(ip)).toBe(true)
    expect(checkRateLimit(ip)).toBe(false)
  })

  it('tracks limits per IP independently', async () => {
    process.env.RATE_LIMIT_PER_MIN = '1'
    const { checkRateLimit } = await import('./rate-limit')
    expect(checkRateLimit('10.0.0.1')).toBe(true)
    expect(checkRateLimit('10.0.0.1')).toBe(false)
    expect(checkRateLimit('10.0.0.2')).toBe(true)
  })
})
