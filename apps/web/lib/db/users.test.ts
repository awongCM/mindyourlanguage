import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

import { query } from '@/lib/db'
import { createAnonUser, findUserIdByAnonTokenHash } from './users'

describe('anonymous users', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset()
  })

  it('findUserIdByAnonTokenHash returns the id when a row exists', async () => {
    vi.mocked(query).mockResolvedValue([{ id: 'user-1' }])

    await expect(findUserIdByAnonTokenHash('hash-1')).resolves.toBe('user-1')

    const [sql, params] = vi.mocked(query).mock.calls[0]!
    expect(String(sql)).toContain('anon_token_hash = $1')
    expect(params).toEqual(['hash-1'])
  })

  it('findUserIdByAnonTokenHash returns null when no row matches', async () => {
    vi.mocked(query).mockResolvedValue([])

    await expect(findUserIdByAnonTokenHash('missing')).resolves.toBeNull()
  })

  it('createAnonUser inserts only the hash and returns the new id', async () => {
    vi.mocked(query).mockResolvedValue([{ id: 'user-2' }])

    await expect(createAnonUser('hash-2')).resolves.toBe('user-2')

    const [sql, params] = vi.mocked(query).mock.calls[0]!
    expect(String(sql)).toContain('INSERT INTO users (anon_token_hash)')
    expect(String(sql)).not.toContain('email')
    expect(params).toEqual(['hash-2'])
  })
})
