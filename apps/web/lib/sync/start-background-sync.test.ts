import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./cloud-sync', () => ({
  pullAllStores: vi.fn(),
  syncAllStores: vi.fn(),
  isApplyingRemoteState: vi.fn(),
}))

import { useHistoryStore } from '@/lib/stores/history'
import {
  isApplyingRemoteState,
  pullAllStores,
  syncAllStores,
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
    vi.mocked(pullAllStores).mockReset().mockResolvedValue('ok')
    vi.mocked(syncAllStores).mockReset().mockResolvedValue(undefined)
    vi.mocked(isApplyingRemoteState).mockReset().mockReturnValue(false)
  })

  afterEach(() => {
    stop()
    stop = () => undefined
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

  it('does not subscribe if stopped before the pull finishes', async () => {
    let finishPull: (value: 'ok') => void = () => undefined
    vi.mocked(pullAllStores).mockReturnValue(
      new Promise((resolve) => {
        finishPull = resolve
      }),
    )
    stop = startBackgroundSync()
    stop()
    finishPull('ok')
    await vi.advanceTimersByTimeAsync(0)

    touchHistory()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(syncAllStores).not.toHaveBeenCalled()
  })
})
