import { useHistoryStore } from '@/lib/stores/history'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
import { useReviewEventsStore } from '@/lib/stores/review-events'
import { waitForSyncStoresHydration } from '@/lib/stores/wait-for-persist-hydration'
import {
  isApplyingRemoteState,
  pullAllStores,
  syncAllStores,
} from './cloud-sync'

export const BACKGROUND_SYNC_DEBOUNCE_MS = 2000

/**
 * Pull this browser's rows once, then push (debounced, quiet) after local
 * changes. Never pushes before a pull has succeeded: if the first pull
 * fails, the next change retries the pull and pushes only if it succeeds.
 *
 * Subscribes as soon as the persisted stores have hydrated (before the pull),
 * so a change made while a slow first pull is in flight is remembered and
 * pushed once the pull settles. Changes caused by applying server rows never
 * count. Returns a stop function. Does nothing further when the server
 * reports sync is not configured.
 */
export function startBackgroundSync(): () => void {
  let stopped = false
  let pulled = false
  let pullSettled = false
  let dirtyDuringPull = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const unsubscribers: Array<() => void> = []

  function unsubscribeAll() {
    for (const unsubscribe of unsubscribers.splice(0)) unsubscribe()
  }

  async function pushWhenPulled() {
    if (!pulled) {
      const result = await pullAllStores()
      if (stopped || result !== 'ok') return
      pulled = true
    }
    await syncAllStores({ quiet: true })
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void pushWhenPulled()
    }, BACKGROUND_SYNC_DEBOUNCE_MS)
  }

  function onLocalChange() {
    if (isApplyingRemoteState()) return
    if (!pullSettled) {
      dirtyDuringPull = true
      return
    }
    schedule()
  }

  void waitForSyncStoresHydration()
    .then(() => {
      if (stopped) return undefined
      unsubscribers.push(
        useHistoryStore.subscribe(onLocalChange),
        usePhrasebookStore.subscribe(onLocalChange),
        useReviewEventsStore.subscribe(onLocalChange),
      )
      return pullAllStores()
    })
    .then((result) => {
      if (stopped || result === undefined) return
      if (result === 'not_configured') {
        unsubscribeAll()
        return
      }
      pulled = result === 'ok'
      pullSettled = true
      if (dirtyDuringPull) {
        dirtyDuringPull = false
        schedule()
      }
    })

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    timer = null
    unsubscribeAll()
  }
}
