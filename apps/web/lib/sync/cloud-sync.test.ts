import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PhrasebookEntry,
  ReviewEvent,
  TranslationRecord,
} from '@mindyourlanguage/shared'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/lib/stores/wait-for-persist-hydration', () => ({
  waitForSyncStoresHydration: vi.fn().mockResolvedValue(undefined),
}))

import { toast } from 'sonner'
import { HISTORY_MAX, useHistoryStore } from '@/lib/stores/history'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
import { useReviewEventsStore } from '@/lib/stores/review-events'
import {
  isApplyingRemoteState,
  mergeById,
  mergeHistory,
  phrasebookEntryUpdatedAt,
  pullAllStores,
  syncAllStores,
} from './cloud-sync'

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

function historyRecord(id: string, createdAt: string): TranslationRecord {
  return {
    id,
    userId: null,
    sourceText: `source-${id}`,
    sourceLang: 'en',
    targetLang: 'zh',
    translation: `translation-${id}`,
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
    createdAt,
  }
}

function phrasebookEntry(id: string): PhrasebookEntry {
  return {
    id,
    translationId: null,
    sourceText: `source-${id}`,
    sourceLang: 'en',
    targetLang: 'zh',
    translation: `translation-${id}`,
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
    tags: [],
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function reviewEvent(id: string, reviewedAt: string): ReviewEvent {
  return { id, phraseId: 'p-1', grade: 'good', reviewedAt, mode: 'self_grade' }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('mergeHistory', () => {
  it('sorts newest first and caps at HISTORY_MAX', () => {
    const local = [historyRecord('old', '2026-01-01T00:00:00.000Z')]
    const remote = Array.from({ length: HISTORY_MAX + 5 }, (_, i) =>
      historyRecord(`r-${i}`, new Date(Date.UTC(2026, 1, i + 1)).toISOString()),
    )

    const merged = mergeHistory(local, remote)

    expect(merged).toHaveLength(HISTORY_MAX)
    expect(merged[0]?.id).toBe(`r-${HISTORY_MAX + 4}`)
    expect(merged.some((row) => row.id === 'old')).toBe(false)
  })
})

describe('cloud sync against the API', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    vi.mocked(toast.error).mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    useHistoryStore.setState({ items: [] })
    usePhrasebookStore.setState({ items: [] })
    useReviewEventsStore.setState({ events: [] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('pullAllStores', () => {
    it('merges server rows into local state and flags the update as remote', async () => {
      useHistoryStore.setState({
        items: [historyRecord('local', '2026-01-01T00:00:00.000Z')],
      })
      fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/history') {
          return jsonResponse({
            items: [historyRecord('server', '2026-02-01T00:00:00.000Z')],
          })
        }
        if (url === '/api/phrasebook') {
          return jsonResponse({ items: [phrasebookEntry('pb-1')] })
        }
        return jsonResponse({
          events: [reviewEvent('ev-1', '2026-02-01T00:00:00.000Z')],
        })
      })

      const seenFlags: boolean[] = []
      const unsubscribe = useHistoryStore.subscribe(() => {
        seenFlags.push(isApplyingRemoteState())
      })

      await expect(pullAllStores()).resolves.toBe('ok')
      unsubscribe()

      expect(useHistoryStore.getState().items.map((row) => row.id)).toEqual([
        'server',
        'local',
      ])
      expect(usePhrasebookStore.getState().items.map((row) => row.id)).toEqual([
        'pb-1',
      ])
      expect(useReviewEventsStore.getState().events.map((row) => row.id)).toEqual(
        ['ev-1'],
      )
      expect(seenFlags).toEqual([true])
      expect(isApplyingRemoteState()).toBe(false)
      expect(fetchMock.mock.calls.every(([, init]) => init === undefined)).toBe(
        true,
      )
    })

    it('returns not_configured on 501 without a toast', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({ error: 'Cloud sync is not configured' }, 501),
      )

      await expect(pullAllStores()).resolves.toBe('not_configured')
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('returns failed on a server error without a toast', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({ error: 'Database error' }, 503),
      )

      await expect(pullAllStores()).resolves.toBe('failed')
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('does not overwrite local data with an empty server response', async () => {
      useHistoryStore.setState({
        items: [historyRecord('local', '2026-01-01T00:00:00.000Z')],
      })
      usePhrasebookStore.setState({ items: [phrasebookEntry('pb-local')] })
      fetchMock.mockImplementation(async (url: string) =>
        jsonResponse(url === '/api/review-events' ? { events: [] } : { items: [] }),
      )

      await pullAllStores()

      expect(useHistoryStore.getState().items).toHaveLength(1)
      expect(usePhrasebookStore.getState().items).toHaveLength(1)
    })
  })

  describe('syncAllStores', () => {
    function okSyncResponses() {
      fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/review-events') return jsonResponse({ events: [] })
        return jsonResponse({ items: [] })
      })
    }

    it('pushes all three stores with PUT/PUT/POST in order', async () => {
      okSyncResponses()
      useHistoryStore.setState({
        items: [historyRecord('h-1', '2026-01-01T00:00:00.000Z')],
      })
      usePhrasebookStore.setState({ items: [phrasebookEntry('pb-1')] })
      useReviewEventsStore.setState({
        events: [reviewEvent('ev-1', '2026-01-01T00:00:00.000Z')],
      })

      await syncAllStores({ quiet: true })

      expect(
        fetchMock.mock.calls.map(([url, init]) => [url, init?.method]),
      ).toEqual([
        ['/api/history', 'PUT'],
        ['/api/phrasebook', 'PUT'],
        ['/api/review-events', 'POST'],
      ])
    })

    it('keeps an item saved locally while the sync was in flight', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/review-events') {
          useHistoryStore.setState({
            items: [historyRecord('during', '2026-03-01T00:00:00.000Z')],
          })
          return jsonResponse({ events: [] })
        }
        return jsonResponse({ items: [] })
      })

      await syncAllStores({ quiet: true })

      expect(useHistoryStore.getState().items.map((row) => row.id)).toEqual([
        'during',
      ])
    })

    it('stays silent on 501', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({ error: 'Cloud sync is not configured' }, 501),
      )

      await syncAllStores()

      expect(toast.error).not.toHaveBeenCalled()
    })

    it('does not toast on a failed background sync', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({ error: 'Database error' }, 503),
      )

      await syncAllStores({ quiet: true })

      expect(toast.error).not.toHaveBeenCalled()
    })

    it('toasts on a failed manual sync', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({ error: 'Database error' }, 503),
      )

      await syncAllStores()

      expect(toast.error).toHaveBeenCalledWith(
        'Cloud sync failed — using local data',
      )
    })

    it('runs one sync at a time and queues a single re-run', async () => {
      let release: () => void = () => undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let firstCall = true
      fetchMock.mockImplementation(async (url: string) => {
        if (firstCall) {
          firstCall = false
          await gate
        }
        return jsonResponse(url === '/api/review-events' ? { events: [] } : { items: [] })
      })

      const first = syncAllStores({ quiet: true })
      const second = syncAllStores({ quiet: true })
      const third = syncAllStores({ quiet: true })
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

      release()
      await Promise.all([first, second, third])
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6))
    })
  })
})
