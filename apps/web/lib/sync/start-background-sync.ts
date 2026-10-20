import { useHistoryStore } from '@/lib/stores/history'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
import { useReviewEventsStore } from '@/lib/stores/review-events'
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
 * Returns a stop function. Does nothing further when the server reports
 * sync is not configured.
 */
export function startBackgroundSync(): () => void {
  let stopped = false
  let pulled = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const unsubscribers: Array<() => void> = []

  async function pushWhenPulled() {
    if (!pulled) {
      const result = await pullAllStores()
      if (stopped || result !== 'ok') return
      pulled = true
    }
    await syncAllStores({ quiet: true })
  }

  function schedule() {
    if (isApplyingRemoteState()) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void pushWhenPulled()
    }, BACKGROUND_SYNC_DEBOUNCE_MS)
  }

  void pullAllStores().then((result) => {
    if (stopped || result === 'not_configured') return
    pulled = result === 'ok'
    unsubscribers.push(
      useHistoryStore.subscribe(schedule),
      usePhrasebookStore.subscribe(schedule),
      useReviewEventsStore.subscribe(schedule),
    )
  })

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    timer = null
    for (const unsubscribe of unsubscribers) unsubscribe()
  }
}
