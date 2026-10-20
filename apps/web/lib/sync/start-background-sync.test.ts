import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./cloud-sync', () => ({
  pullAllStores: vi.fn(),
  syncAllStores: vi.fn(),
  isApplyingRemoteState: vi.fn(),
}))

vi.mock('@/lib/stores/wait-for-persist-hydration', () => ({
  waitForSyncStoresHydration: vi.fn(),
}))

import { useHistoryStore } from '@/lib/stores/history'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
import { useReviewEventsStore } from '@/lib/stores/review-events'
import { waitForSyncStoresHydration } from '@/lib/stores/wait-for-persist-hydration'
import {
  isApplyingRemoteState,
  pullAllStores,
  syncAllStores,
  type PullResult,
} from './cloud-sync'
import {
  BACKGROUND_SYNC_DEBOUNCE_MS,
  startBackgroundSync,
} from './start-background-sync'

function touchHistory() {
  useHistoryStore.setState({ items: [] })
}

describe('startBackgroundSync', () => {
  let stop: () => void = () => undefined

  async function start() {
    stop = startBackgroundSync()
    await vi.advanceTimersByTimeAsync(0)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(waitForSyncStoresHydration)
      .mockReset()
      .mockResolvedValue(undefined)
    vi.mocked(pullAllStores).mockReset().mockResolvedValue('ok')
    vi.mocked(syncAllStores).mockReset().mockResolvedValue(undefined)
    vi.mocked(isApplyingRemoteState).mockReset().mockReturnValue(false)
  })

  afterEach(() => {
    stop()
    stop = () => undefined
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('pulls once and does not push when nothing changes', async () => {
    await start()

    await vi.advanceTimersByTimeAsync(10_000)

    expect(pullAllStores).toHaveBeenCalledTimes(1)
    expect(syncAllStores).not.toHaveBeenCalled()
  })

  it('pushes quietly after the debounce and collapses rapid changes', async () => {
    await start()

    touchHistory()
    await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS - 1)
    touchHistory()
    await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS - 1)
    expect(syncAllStores).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(syncAllStores).toHaveBeenCalledTimes(1)
    expect(syncAllStores).toHaveBeenCalledWith({ quiet: true })
    expect(pullAllStores).toHaveBeenCalledTimes(1)
  })

  it('does not subscribe when sync is not configured on the server', async () => {
    vi.mocked(pullAllStores).mockResolvedValue('not_configured')
    await start()

    touchHistory()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(syncAllStores).not.toHaveBeenCalled()
  })

  it('retries the pull before pushing after a failed pull, and never pushes before a pull succeeds', async () => {
    vi.mocked(pullAllStores)
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('ok')
    await start()

    touchHistory()
    await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS)
    expect(pullAllStores).toHaveBeenCalledTimes(2)
    expect(syncAllStores).not.toHaveBeenCalled()

    touchHistory()
    await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS)
    expect(pullAllStores).toHaveBeenCalledTimes(3)
    expect(syncAllStores).toHaveBeenCalledTimes(1)
    expect(syncAllStores).toHaveBeenCalledWith({ quiet: true })
  })

  it('ignores store updates that come from applying server rows', async () => {
    await start()
    vi.mocked(isApplyingRemoteState).mockReturnValue(true)

    touchHistory()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(syncAllStores).not.toHaveBeenCalled()
  })

  it('stop cancels a pending push and unsubscribes', async () => {
    await start()

    touchHistory()
    stop()
    await vi.advanceTimersByTimeAsync(5_000)
    touchHistory()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(syncAllStores).not.toHaveBeenCalled()
  })

  it('does not pull or subscribe if stopped before the stores hydrate', async () => {
    let finishHydration: () => void = () => undefined
    vi.mocked(waitForSyncStoresHydration).mockReturnValue(
      new Promise<void>((resolve) => {
        finishHydration = resolve
      }),
    )
    stop = startBackgroundSync()
    stop()
    finishHydration()
    await vi.advanceTimersByTimeAsync(0)

    touchHistory()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(pullAllStores).not.toHaveBeenCalled()
    expect(syncAllStores).not.toHaveBeenCalled()
  })

  describe('changes made while the initial pull is in flight', () => {
    let finishPull: (value: PullResult) => void = () => undefined

    async function startWithPendingPull() {
      vi.mocked(pullAllStores).mockReturnValueOnce(
        new Promise<PullResult>((resolve) => {
          finishPull = resolve
        }),
      )
      await start()
    }

    it('pushes once, quietly, after the pull succeeds', async () => {
      await startWithPendingPull()

      touchHistory()
      touchHistory()
      await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS * 2)
      expect(syncAllStores).not.toHaveBeenCalled()

      finishPull('ok')
      await vi.advanceTimersByTimeAsync(0)
      expect(syncAllStores).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS)
      expect(syncAllStores).toHaveBeenCalledTimes(1)
      expect(syncAllStores).toHaveBeenCalledWith({ quiet: true })
      expect(pullAllStores).toHaveBeenCalledTimes(1)
    })

    it('retries the pull after a failed pull and pushes only if it then succeeds', async () => {
      await startWithPendingPull()
      vi.mocked(pullAllStores).mockResolvedValueOnce('failed')

      touchHistory()
      finishPull('failed')
      await vi.advanceTimersByTimeAsync(0)
      expect(pullAllStores).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS)
      expect(pullAllStores).toHaveBeenCalledTimes(2)
      expect(syncAllStores).not.toHaveBeenCalled()

      vi.mocked(pullAllStores).mockResolvedValueOnce('ok')
      touchHistory()
      await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS)
      expect(pullAllStores).toHaveBeenCalledTimes(3)
      expect(syncAllStores).toHaveBeenCalledTimes(1)
      expect(syncAllStores).toHaveBeenCalledWith({ quiet: true })
    })

    it('does not push when nothing changed during the pull', async () => {
      await startWithPendingPull()

      finishPull('ok')
      await vi.advanceTimersByTimeAsync(10_000)

      expect(syncAllStores).not.toHaveBeenCalled()
    })

    it('does not push or react later when the pull reports not_configured', async () => {
      // Wrap each store's subscribe so the returned unsubscribe functions can
      // be observed: a later store change alone would not show a leaked
      // subscription, because pullSettled/pulled never lead to a push here.
      const unsubscribes: Array<ReturnType<typeof vi.fn>> = []
      type Subscribable = { subscribe: (listener: () => void) => () => void }
      const stores: Subscribable[] = [
        useHistoryStore,
        usePhrasebookStore,
        useReviewEventsStore,
      ]
      for (const store of stores) {
        const realSubscribe = store.subscribe.bind(store)
        vi.spyOn(store, 'subscribe').mockImplementation((listener) => {
          const wrapped = vi.fn(realSubscribe(listener))
          unsubscribes.push(wrapped)
          return wrapped
        })
      }

      await startWithPendingPull()
      expect(unsubscribes).toHaveLength(3)
      expect(unsubscribes.some((fn) => fn.mock.calls.length > 0)).toBe(false)

      touchHistory()
      finishPull('not_configured')
      await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS * 2)

      // not_configured must drop all three subscriptions, before stop() runs.
      for (const fn of unsubscribes) expect(fn).toHaveBeenCalledTimes(1)

      touchHistory()
      await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS * 2)

      expect(syncAllStores).not.toHaveBeenCalled()
      expect(pullAllStores).toHaveBeenCalledTimes(1)
    })

    it('ignores remote applies during the pull (no dirty flag)', async () => {
      await startWithPendingPull()
      vi.mocked(isApplyingRemoteState).mockReturnValue(true)

      touchHistory()
      vi.mocked(isApplyingRemoteState).mockReturnValue(false)
      finishPull('ok')
      await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS * 2)

      expect(syncAllStores).not.toHaveBeenCalled()
    })

    it('does not push if stopped before the pull resolves', async () => {
      await startWithPendingPull()

      touchHistory()
      stop()
      finishPull('ok')
      await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS * 2)
      touchHistory()
      await vi.advanceTimersByTimeAsync(BACKGROUND_SYNC_DEBOUNCE_MS * 2)

      expect(syncAllStores).not.toHaveBeenCalled()
    })
  })
})
