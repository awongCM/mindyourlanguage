import { describe, expect, it } from 'vitest'
import { mergeById } from './cloud-sync'

describe('mergeById', () => {
  it('prefers remote when ids match and remote is newer', () => {
    const local = [{ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }]
    const remote = [{ id: 'a', createdAt: '2026-01-02T00:00:00.000Z' }]
    const merged = mergeById(local, remote, (row) => row.createdAt)
    expect(merged[0]?.createdAt).toBe('2026-01-02T00:00:00.000Z')
  })

  it('keeps local when it is newer than remote', () => {
    const local = [{ id: 'a', createdAt: '2026-02-01T00:00:00.000Z' }]
    const remote = [{ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }]
    const merged = mergeById(local, remote, (row) => row.createdAt)
    expect(merged[0]?.createdAt).toBe('2026-02-01T00:00:00.000Z')
  })

  it('includes rows unique to either side', () => {
    const local = [{ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }]
    const remote = [{ id: 'b', createdAt: '2026-01-01T00:00:00.000Z' }]
    const merged = mergeById(local, remote, (row) => row.createdAt)
    expect(merged.map((row) => row.id).sort()).toEqual(['a', 'b'])
  })
})
