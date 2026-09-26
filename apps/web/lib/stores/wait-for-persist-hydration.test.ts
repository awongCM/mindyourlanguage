import { beforeEach, describe, expect, it, vi } from 'vitest'

const { historyPersist, phrasebookPersist, reviewEventsPersist } = vi.hoisted(
  () => {
    function createPersistMock() {
      return {
        hasHydrated: vi.fn(() => false),
        onFinishHydration: vi.fn((fn: () => void) => {
          fn()
          return () => undefined
        }),
      }
    }
    return {
      historyPersist: createPersistMock(),
      phrasebookPersist: createPersistMock(),
      reviewEventsPersist: createPersistMock(),
    }
  },
)

vi.mock('@/lib/stores/history', () => ({
  useHistoryStore: { persist: historyPersist },
}))
vi.mock('@/lib/stores/phrasebook', () => ({
  usePhrasebookStore: { persist: phrasebookPersist },
}))
vi.mock('@/lib/stores/review-events', () => ({
  useReviewEventsStore: { persist: reviewEventsPersist },
}))

import { waitForSyncStoresHydration } from './wait-for-persist-hydration'

describe('waitForSyncStoresHydration', () => {
  beforeEach(() => {
    for (const persist of [
      historyPersist,
      phrasebookPersist,
      reviewEventsPersist,
    ]) {
      persist.hasHydrated.mockReturnValue(false)
      persist.onFinishHydration.mockImplementation((fn: () => void) => {
        fn()
        return () => undefined
      })
    }
  })

  it('resolves after all three stores finish hydration', async () => {
    await waitForSyncStoresHydration()
    expect(historyPersist.onFinishHydration).toHaveBeenCalled()
    expect(phrasebookPersist.onFinishHydration).toHaveBeenCalled()
    expect(reviewEventsPersist.onFinishHydration).toHaveBeenCalled()
  })

  it('skips onFinishHydration when already hydrated', async () => {
    historyPersist.hasHydrated.mockReturnValue(true)
    phrasebookPersist.hasHydrated.mockReturnValue(true)
    reviewEventsPersist.hasHydrated.mockReturnValue(true)
    historyPersist.onFinishHydration.mockClear()
    phrasebookPersist.onFinishHydration.mockClear()
    reviewEventsPersist.onFinishHydration.mockClear()

    await waitForSyncStoresHydration()

    expect(historyPersist.onFinishHydration).not.toHaveBeenCalled()
    expect(phrasebookPersist.onFinishHydration).not.toHaveBeenCalled()
    expect(reviewEventsPersist.onFinishHydration).not.toHaveBeenCalled()
  })
})
