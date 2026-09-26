import type { StoreApi } from 'zustand'
import { useHistoryStore } from '@/lib/stores/history'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
import { useReviewEventsStore } from '@/lib/stores/review-events'

type PersistCapableStore = StoreApi<unknown> & {
  persist: {
    hasHydrated: () => boolean
    onFinishHydration: (fn: () => void) => () => void
  }
}

function waitForStoreHydration(store: PersistCapableStore): Promise<void> {
  if (store.persist.hasHydrated()) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    let unsubscribe: () => void = () => {}
    unsubscribe = store.persist.onFinishHydration(() => {
      unsubscribe()
      resolve()
    })
  })
}

/** Wait until localStorage-backed Zustand stores have rehydrated. */
export function waitForSyncStoresHydration(): Promise<void> {
  return Promise.all([
    waitForStoreHydration(useHistoryStore),
    waitForStoreHydration(usePhrasebookStore),
    waitForStoreHydration(useReviewEventsStore),
  ]).then(() => undefined)
}
