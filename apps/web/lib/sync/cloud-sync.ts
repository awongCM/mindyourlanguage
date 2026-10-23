import type {
  PhrasebookEntry,
  ReviewEvent,
  TranslationRecord,
} from '@mindyourlanguage/shared'
import { toast } from 'sonner'
import { HISTORY_MAX, useHistoryStore } from '@/lib/stores/history'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
import {
  REVIEW_EVENTS_MAX,
  useReviewEventsStore,
} from '@/lib/stores/review-events'
import { REVIEW_EVENTS_SYNC_MAX } from './limits'
import { waitForSyncStoresHydration } from '@/lib/stores/wait-for-persist-hydration'

type Identifiable = { id: string }

export class SyncNotConfiguredError extends Error {
  constructor() {
    super('Cloud sync is not configured')
    this.name = 'SyncNotConfiguredError'
  }
}

export type SyncOptions = { quiet?: boolean }
export type PullResult = 'ok' | 'not_configured' | 'failed'

let applyingRemote = false

/**
 * Ids of the rows the server last reported, per store. Filled from every pull
 * and push response; starts empty on each page load. Only rows in this set can
 * be sent as `deletedIds`, so nothing the server has not shown us is ever
 * deleted.
 */
const lastServerIds = {
  history: new Set<string>(),
  phrasebook: new Set<string>(),
}

/** Test-only: forget what the server last reported. */
export function resetCloudSyncStateForTests(): void {
  lastServerIds.history = new Set()
  lastServerIds.phrasebook = new Set()
}

/** True while server rows are being written into the stores. */
export function isApplyingRemoteState(): boolean {
  return applyingRemote
}

function applyRemote(apply: () => void): void {
  applyingRemote = true
  try {
    apply()
  } finally {
    applyingRemote = false
  }
}

export function mergeById<T extends Identifiable>(
  local: T[],
  remote: T[],
  getUpdatedAt: (row: T) => string,
): T[] {
  const byId = new Map<string, T>()

  for (const row of local) {
    byId.set(row.id, row)
  }

  for (const row of remote) {
    const existing = byId.get(row.id)
    if (!existing) {
      byId.set(row.id, row)
      continue
    }
    const existingMs = Date.parse(getUpdatedAt(existing))
    const remoteMs = Date.parse(getUpdatedAt(row))
    byId.set(row.id, remoteMs >= existingMs ? row : existing)
  }

  return [...byId.values()]
}

export function mergeHistory(
  local: TranslationRecord[],
  remote: TranslationRecord[],
): TranslationRecord[] {
  return mergeById(local, remote, (row) => row.createdAt)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, HISTORY_MAX)
}

export function mergeReviewEvents(
  local: ReviewEvent[],
  remote: ReviewEvent[],
): ReviewEvent[] {
  return mergeById(local, remote, (row) => row.reviewedAt)
    .sort((a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt))
    .slice(0, REVIEW_EVENTS_MAX)
}

/** Newest-first slice for POST; keeps requests within server count limits. */
function reviewEventsForSync(events: ReviewEvent[]): ReviewEvent[] {
  return [...events]
    .sort((a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt))
    .slice(0, REVIEW_EVENTS_SYNC_MAX)
}

export function phrasebookEntryUpdatedAt(entry: PhrasebookEntry): string {
  const createdMs = Date.parse(entry.createdAt)
  let latest = entry.createdAt
  let latestMs = createdMs

  for (const value of [
    entry.practiceStats?.lastReviewedAt,
    entry.practiceStats?.fluency?.lastSessionAt,
  ]) {
    if (!value) continue
    const valueMs = Date.parse(value)
    if (Number.isNaN(valueMs)) continue
    if (!Number.isNaN(createdMs) && valueMs < createdMs) continue
    if (Number.isNaN(latestMs) || valueMs >= latestMs) {
      latest = value
      latestMs = valueMs
    }
  }

  return latest
}

async function readJson<T>(res: Response): Promise<T> {
  if (res.status === 501) throw new SyncNotConfiguredError()
  if (!res.ok) {
    throw new Error(`Sync request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

async function sendJson<T>(
  url: string,
  method: 'PUT' | 'POST',
  body: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readJson<T>(res)
}

/** Ids the server last reported that are no longer in the local list. */
function removedLocally(
  serverIds: Set<string>,
  local: Identifiable[],
): string[] {
  const localIds = new Set(local.map((row) => row.id))
  return [...serverIds].filter((id) => !localIds.has(id))
}

/**
 * Drop remote rows that were local when a request started (`sent`: pushed, or
 * present at pull start) but have since been removed locally, so a delete made
 * during the request is not undone by the response. Rows that were not local
 * then (for example new from another tab) are kept.
 */
function withoutDeletedDuringPush<T extends Identifiable>(
  remote: T[],
  current: Identifiable[],
  sent: Set<string>,
): T[] {
  const currentIds = new Set(current.map((row) => row.id))
  return remote.filter((row) => currentIds.has(row.id) || !sent.has(row.id))
}

/**
 * Merge server rows into the current local state (read at call time). Pass
 * `sent` (ids local when the request started) to skip rows deleted locally
 * while it was in flight.
 */
function applyRemoteRows(
  rows: {
    history: TranslationRecord[]
    phrasebook: PhrasebookEntry[]
    events: ReviewEvent[]
  },
  sent?: { history: Set<string>; phrasebook: Set<string> },
): void {
  // Track the server's unfiltered answer so a locally deleted row is still
  // named in the next push's deletedIds.
  lastServerIds.history = new Set(rows.history.map((row) => row.id))
  lastServerIds.phrasebook = new Set(rows.phrasebook.map((row) => row.id))

  const historyRows = sent
    ? withoutDeletedDuringPush(
        rows.history,
        useHistoryStore.getState().items,
        sent.history,
      )
    : rows.history
  const phrasebookRows = sent
    ? withoutDeletedDuringPush(
        rows.phrasebook,
        usePhrasebookStore.getState().items,
        sent.phrasebook,
      )
    : rows.phrasebook

  applyRemote(() => {
    useHistoryStore.setState({
      items: mergeHistory(useHistoryStore.getState().items, historyRows),
    })
    usePhrasebookStore.setState({
      items: mergeById(
        usePhrasebookStore.getState().items,
        phrasebookRows,
        phrasebookEntryUpdatedAt,
      ),
    })
    useReviewEventsStore.setState({
      events: mergeReviewEvents(
        useReviewEventsStore.getState().events,
        rows.events,
      ),
    })
  })
}

/** Load this browser's rows from the server and merge them locally. Never pushes. */
export async function pullAllStores(): Promise<PullResult> {
  if (typeof window === 'undefined') return 'failed'

  try {
    await waitForSyncStoresHydration()

    // Rows that are local now; one missing when the response arrives was
    // deleted during the request and must not be brought back.
    const present = {
      history: new Set(useHistoryStore.getState().items.map((row) => row.id)),
      phrasebook: new Set(
        usePhrasebookStore.getState().items.map((row) => row.id),
      ),
    }

    const [historyRes, phrasebookRes, eventsRes] = await Promise.all([
      fetch('/api/history'),
      fetch('/api/phrasebook'),
      fetch('/api/review-events'),
    ])
    const history = await readJson<{ items: TranslationRecord[] }>(historyRes)
    const phrasebook = await readJson<{ items: PhrasebookEntry[] }>(
      phrasebookRes,
    )
    const events = await readJson<{ events: ReviewEvent[] }>(eventsRes)

    applyRemoteRows(
      {
        history: history.items,
        phrasebook: phrasebook.items,
        events: events.events,
      },
      present,
    )
    return 'ok'
  } catch (error) {
    if (error instanceof SyncNotConfiguredError) return 'not_configured'
    console.warn('Cloud pull failed', error)
    return 'failed'
  }
}

async function runSync(options: SyncOptions): Promise<void> {
  try {
    await waitForSyncStoresHydration()

    const historySnapshot = useHistoryStore.getState().items
    const phrasebookSnapshot = usePhrasebookStore.getState().items

    const history = await sendJson<{ items: TranslationRecord[] }>(
      '/api/history',
      'PUT',
      {
        items: historySnapshot,
        deletedIds: removedLocally(lastServerIds.history, historySnapshot),
      },
    )
    const phrasebook = await sendJson<{ items: PhrasebookEntry[] }>(
      '/api/phrasebook',
      'PUT',
      {
        items: phrasebookSnapshot,
        deletedIds: removedLocally(lastServerIds.phrasebook, phrasebookSnapshot),
      },
    )
    const events = await sendJson<{ events: ReviewEvent[] }>(
      '/api/review-events',
      'POST',
      {
        events: reviewEventsForSync(useReviewEventsStore.getState().events),
      },
    )

    applyRemoteRows(
      {
        history: history.items,
        phrasebook: phrasebook.items,
        events: events.events,
      },
      {
        history: new Set(historySnapshot.map((row) => row.id)),
        phrasebook: new Set(phrasebookSnapshot.map((row) => row.id)),
      },
    )
  } catch (error) {
    if (error instanceof SyncNotConfiguredError) return
    if (options.quiet) {
      console.warn('Background cloud sync failed', error)
      return
    }
    toast.error('Cloud sync failed — using local data')
  }
}

let inFlight: Promise<void> | null = null
let queuedOptions: SyncOptions | null = null

/**
 * Push local rows, then merge the server's answer into the current local
 * state. One run at a time; calls made during a run queue a single re-run.
 */
export function syncAllStores(options: SyncOptions = {}): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()

  if (inFlight) {
    // A queued quiet call must not hide a queued manual one.
    queuedOptions = {
      quiet: Boolean(queuedOptions?.quiet ?? true) && Boolean(options.quiet),
    }
    return inFlight
  }

  inFlight = runSync(options).finally(() => {
    inFlight = null
    if (queuedOptions) {
      const next = queuedOptions
      queuedOptions = null
      void syncAllStores(next)
    }
  })
  return inFlight
}
