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
import {
  REVIEW_EVENTS_MAX,
  useReviewEventsStore,
} from '@/lib/stores/review-events'
import {
  isApplyingRemoteState,
  mergeById,
  mergeHistory,
  mergeReviewEvents,
  phrasebookEntryUpdatedAt,
  pullAllStores,
  resetCloudSyncStateForTests,
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

  it('uses a speed session when it is newer than the last review', () => {
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
        fluency: {
          fastDays: ['2026-03-01'],
          lastSessionAt: '2026-03-01T15:00:00.000Z',
        },
      },
    })
    expect(at).toBe('2026-03-01T15:00:00.000Z')
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

describe('mergeReviewEvents', () => {
  it('sorts newest first and caps at REVIEW_EVENTS_MAX', () => {
    const local = Array.from({ length: REVIEW_EVENTS_MAX }, (_, i) =>
      reviewEvent(
        `local-${i}`,
        new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      ),
    )
    const remote = Array.from({ length: 500 }, (_, i) =>
      reviewEvent(
        `remote-${i}`,
        new Date(Date.UTC(2026, 1, 1, 0, 0, i)).toISOString(),
      ),
    )

    const merged = mergeReviewEvents(local, remote)

    expect(merged).toHaveLength(REVIEW_EVENTS_MAX)
    expect(merged.some((row) => row.id.startsWith('remote-'))).toBe(true)
    expect(merged.some((row) => row.id === 'local-0')).toBe(false)
  })
})

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
    resetCloudSyncStateForTests()
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

  function okSyncResponses() {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/review-events') return jsonResponse({ events: [] })
      return jsonResponse({ items: [] })
    })
  }

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
    it('caps review events in the POST body at REVIEW_EVENTS_MAX', async () => {
      okSyncResponses()
      useReviewEventsStore.setState({
        events: Array.from({ length: REVIEW_EVENTS_MAX + 200 }, (_, i) =>
          reviewEvent(
            `ev-${i}`,
            new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
          ),
        ),
      })

      await syncAllStores({ quiet: true })

      const post = fetchMock.mock.calls.find(
        ([url, init]) => url === '/api/review-events' && init?.method === 'POST',
      )
      const body = JSON.parse(String(post?.[1]?.body)) as {
        events: ReviewEvent[]
      }
      expect(body.events).toHaveLength(REVIEW_EVENTS_MAX)
      expect(body.events[0]?.id).toBe(`ev-${REVIEW_EVENTS_MAX + 199}`)
    })

    it('trims merged review events after a pull with more than REVIEW_EVENTS_MAX rows', async () => {
      useReviewEventsStore.setState({
        events: Array.from({ length: REVIEW_EVENTS_MAX }, (_, i) =>
          reviewEvent(
            `local-${i}`,
            new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
          ),
        ),
      })
      fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/review-events') {
          return jsonResponse({
            events: Array.from({ length: 500 }, (_, i) =>
              reviewEvent(
                `remote-${i}`,
                new Date(Date.UTC(2026, 1, 1, 0, 0, i)).toISOString(),
              ),
            ),
          })
        }
        return jsonResponse({ items: [] })
      })

      await pullAllStores()

      expect(useReviewEventsStore.getState().events).toHaveLength(
        REVIEW_EVENTS_MAX,
      )
    })

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

    it('does not resurrect a row deleted locally while the push was in flight', async () => {
      usePhrasebookStore.setState({
        items: [phrasebookEntry('a'), phrasebookEntry('b')],
      })
      fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/review-events') return jsonResponse({ events: [] })
        if (url === '/api/phrasebook') {
          usePhrasebookStore.setState({
            items: usePhrasebookStore
              .getState()
              .items.filter((row) => row.id !== 'b'),
          })
          return jsonResponse({
            items: [phrasebookEntry('a'), phrasebookEntry('b')],
          })
        }
        return jsonResponse({ items: [] })
      })

      await syncAllStores({ quiet: true })

      expect(
        usePhrasebookStore.getState().items.map((row) => row.id),
      ).toEqual(['a'])

      fetchMock.mockClear()
      await syncAllStores({ quiet: true })
      const put = fetchMock.mock.calls.find(
        ([url, init]) => url === '/api/phrasebook' && init?.method === 'PUT',
      )
      expect(JSON.parse(String(put?.[1]?.body)).deletedIds).toEqual(['b'])
    })

    it('still adds server rows that were never sent (for example from another tab)', async () => {
      usePhrasebookStore.setState({ items: [phrasebookEntry('a')] })
      fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/review-events') return jsonResponse({ events: [] })
        if (url === '/api/phrasebook') {
          return jsonResponse({
            items: [phrasebookEntry('a'), phrasebookEntry('other-tab')],
          })
        }
        return jsonResponse({ items: [] })
      })

      await syncAllStores({ quiet: true })

      expect(
        usePhrasebookStore.getState().items.map((row) => row.id).sort(),
      ).toEqual(['a', 'other-tab'])
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

    async function failingRunWithQueued(queue: Array<{ quiet?: boolean }>) {
      let release: () => void = () => undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let firstCall = true
      fetchMock.mockImplementation(async () => {
        if (firstCall) {
          firstCall = false
          await gate
        }
        return jsonResponse({ error: 'Database error' }, 503)
      })

      const first = syncAllStores({ quiet: true })
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      for (const options of queue) void syncAllStores(options)

      release()
      await first
      // 1 failed call for the first run + 1 for the re-run (fails at /api/history)
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    it('keeps a queued manual sync loud when a quiet call is queued after it', async () => {
      await failingRunWithQueued([{}, { quiet: true }])

      expect(toast.error).toHaveBeenCalledTimes(1)
    })

    it('keeps a queued manual sync loud when a quiet call was queued before it', async () => {
      await failingRunWithQueued([{ quiet: true }, {}])

      expect(toast.error).toHaveBeenCalledTimes(1)
    })

    it('stays quiet when every queued call is quiet', async () => {
      await failingRunWithQueued([{ quiet: true }, { quiet: true }])

      expect(toast.error).not.toHaveBeenCalled()
    })
  })

  describe('explicit deletedIds', () => {
    function serverHas(ids: string[]) {
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === '/api/review-events') return jsonResponse({ events: [] })
        if (init?.method === 'PUT') {
          const body = JSON.parse(String(init.body)) as { items: unknown[] }
          return jsonResponse({ items: body.items })
        }
        return jsonResponse({
          items:
            url === '/api/history'
              ? ids.map((id) => historyRecord(id, '2026-01-01T00:00:00.000Z'))
              : ids.map((id) => phrasebookEntry(id)),
        })
      })
    }

    function putBody(url: string): { items: { id: string }[]; deletedIds: string[] } {
      const call = fetchMock.mock.calls.find(
        ([callUrl, init]) => callUrl === url && init?.method === 'PUT',
      )
      return JSON.parse(String(call?.[1]?.body))
    }

    it('sends rows the server had and the user then removed locally', async () => {
      serverHas(['a', 'b'])
      await pullAllStores()
      expect(useHistoryStore.getState().items.map((row) => row.id).sort()).toEqual(
        ['a', 'b'],
      )

      useHistoryStore.setState({
        items: useHistoryStore.getState().items.filter((row) => row.id !== 'b'),
      })
      usePhrasebookStore.setState({
        items: usePhrasebookStore.getState().items.filter((row) => row.id !== 'b'),
      })
      fetchMock.mockClear()

      await syncAllStores({ quiet: true })

      expect(putBody('/api/history').deletedIds).toEqual(['b'])
      expect(putBody('/api/phrasebook').deletedIds).toEqual(['b'])
      expect(putBody('/api/history').items.map((row) => row.id)).toEqual(['a'])
    })

    it('sends no deletedIds without a prior pull', async () => {
      okSyncResponses()
      usePhrasebookStore.setState({ items: [phrasebookEntry('only-local')] })

      await syncAllStores({ quiet: true })

      expect(putBody('/api/history').deletedIds).toEqual([])
      expect(putBody('/api/phrasebook').deletedIds).toEqual([])
    })

    it('sends no deletedIds after a failed pull', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({ error: 'Database error' }, 503),
      )
      await expect(pullAllStores()).resolves.toBe('failed')

      okSyncResponses()
      fetchMock.mockClear()
      await syncAllStores({ quiet: true })

      expect(putBody('/api/history').deletedIds).toEqual([])
      expect(putBody('/api/phrasebook').deletedIds).toEqual([])
    })

    it('does not bring back a row deleted locally while a pull is in flight', async () => {
      serverHas(['a', 'b'])
      await pullAllStores()

      let release: () => void = () => undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let gated = true
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const body = JSON.parse(String(init.body)) as { items: unknown[] }
          return jsonResponse({ items: body.items })
        }
        if (gated) {
          gated = false
          await gate
        }
        if (url === '/api/review-events') return jsonResponse({ events: [] })
        if (url === '/api/history') {
          return jsonResponse({
            items: [
              { ...historyRecord('a', '2026-01-01T00:00:00.000Z'), translation: 'server-a' },
              historyRecord('b', '2026-01-01T00:00:00.000Z'),
              historyRecord('c', '2026-01-01T00:00:00.000Z'),
            ],
          })
        }
        return jsonResponse({
          items: [phrasebookEntry('a'), phrasebookEntry('b'), phrasebookEntry('c')],
        })
      })

      fetchMock.mockClear()
      const pull = pullAllStores()
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

      // The user deletes "b" while the pull request is still pending.
      useHistoryStore.setState({
        items: useHistoryStore.getState().items.filter((row) => row.id !== 'b'),
      })
      usePhrasebookStore.setState({
        items: usePhrasebookStore.getState().items.filter((row) => row.id !== 'b'),
      })
      release()
      await expect(pull).resolves.toBe('ok')

      // "b" stays deleted, "c" (new on the server) is kept, and "a" (local at
      // pull start, returned by the server, still local) merges as usual.
      const historyIds = useHistoryStore.getState().items.map((row) => row.id).sort()
      const phrasebookIds = usePhrasebookStore.getState().items.map((row) => row.id).sort()
      expect(historyIds).toEqual(['a', 'c'])
      expect(phrasebookIds).toEqual(['a', 'c'])
      expect(
        useHistoryStore.getState().items.find((row) => row.id === 'a')?.translation,
      ).toBe('server-a')

      fetchMock.mockClear()
      await syncAllStores({ quiet: true })

      expect(putBody('/api/history').deletedIds).toEqual(['b'])
      expect(putBody('/api/phrasebook').deletedIds).toEqual(['b'])
    })

    it('does not re-send ids after the server has confirmed the delete', async () => {
      serverHas(['a', 'b'])
      await pullAllStores()
      usePhrasebookStore.setState({
        items: usePhrasebookStore.getState().items.filter((row) => row.id !== 'b'),
      })

      await syncAllStores({ quiet: true })
      fetchMock.mockClear()
      await syncAllStores({ quiet: true })

      expect(putBody('/api/phrasebook').deletedIds).toEqual([])
    })
  })
})
