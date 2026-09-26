import { describe, expect, it } from 'vitest'
import { mergeById, phrasebookEntryUpdatedAt } from './cloud-sync'

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

describe('phrasebookEntryUpdatedAt', () => {
  it('uses lastReviewedAt when SRS progress is newer than createdAt', () => {
    const at = phrasebookEntryUpdatedAt({
      id: '1',
      translationId: null,
      sourceText: 'a',
      sourceLang: 'en',
      targetLang: 'zh',
      translation: 'b',
      characterSet: 'simplified',
      dictionaryMatches: [],
      segments: [],
      tags: [],
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      practiceStats: {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: '2026-01-03T00:00:00.000Z',
        lastReviewedAt: '2026-02-01T12:00:00.000Z',
      },
    })
    expect(at).toBe('2026-02-01T12:00:00.000Z')
  })

  it('falls back to createdAt when practice stats are absent', () => {
    expect(
      phrasebookEntryUpdatedAt({
        id: '1',
        translationId: null,
        sourceText: 'a',
        sourceLang: 'en',
        targetLang: 'zh',
        translation: 'b',
        characterSet: 'simplified',
        dictionaryMatches: [],
        segments: [],
        tags: [],
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe('2026-01-01T00:00:00.000Z')
  })

  it('merge prefers entry with newer SRS activity', () => {
    const local = [
      {
        id: 'a',
        translationId: null,
        sourceText: 'x',
        sourceLang: 'en' as const,
        targetLang: 'zh' as const,
        translation: 'y',
        characterSet: 'simplified' as const,
        dictionaryMatches: [],
        segments: [],
        tags: [],
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        practiceStats: {
          easeFactor: 2.5,
          intervalDays: 3,
          repetitions: 2,
          nextReviewAt: '2026-01-10T00:00:00.000Z',
          lastReviewedAt: '2026-02-01T00:00:00.000Z',
        },
      },
    ]
    const remote = [
      {
        ...local[0],
        practiceStats: {
          easeFactor: 2.5,
          intervalDays: 1,
          repetitions: 1,
          nextReviewAt: '2026-01-05T00:00:00.000Z',
          lastReviewedAt: '2026-01-15T00:00:00.000Z',
        },
      },
    ]
    const merged = mergeById(local, remote, phrasebookEntryUpdatedAt)
    expect(merged[0]?.practiceStats?.intervalDays).toBe(3)
  })
})
