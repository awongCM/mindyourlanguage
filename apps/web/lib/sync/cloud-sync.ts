import type {
  PhrasebookEntry,
  ReviewEvent,
  TranslationRecord,
} from '@mindyourlanguage/shared'
import { toast } from 'sonner'
import { HISTORY_MAX, useHistoryStore } from '@/lib/stores/history'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
import { useReviewEventsStore } from '@/lib/stores/review-events'
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

export function phrasebookEntryUpdatedAt(entry: PhrasebookEntry): string {
  const reviewedAt = entry.practiceStats?.lastReviewedAt
  if (reviewedAt) {
    const reviewedMs = Date.parse(reviewedAt)
    const createdMs = Date.parse(entry.createdAt)
    if (!Number.isNaN(reviewedMs) && reviewedMs >= createdMs) {
      return reviewedAt
    }
  }
  return entry.createdAt
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

/** Merge server rows into the current local state (read at call time). */
function applyRemoteRows(rows: {
  history: TranslationRecord[]
  phrasebook: PhrasebookEntry[]
  events: ReviewEvent[]
}): void {
  lastServerIds.history = new Set(rows.history.map((row) => row.id))
  lastServerIds.phrasebook = new Set(rows.phrasebook.map((row) => row.id))

  applyRemote(() => {
    useHistoryStore.setState({
      items: mergeHistory(useHistoryStore.getState().items, rows.history),
    })
    usePhrasebookStore.setState({
      items: mergeById(
        usePhrasebookStore.getState().items,
        rows.phrasebook,
        phrasebookEntryUpdatedAt,
      ),
    })
    useReviewEventsStore.setState({
      events: mergeById(
        useReviewEventsStore.getState().events,
        rows.events,
        (row) => row.reviewedAt,
      ),
    })
  })
}

/** Load this browser's rows from the server and merge them locally. Never pushes. */
export async function pullAllStores(): Promise<PullResult> {
  if (typeof window === 'undefined') return 'failed'

  try {
    await waitForSyncStoresHydration()

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

    applyRemoteRows({
      history: history.items,
      phrasebook: phrasebook.items,
      events: events.events,
    })
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
      { events: useReviewEventsStore.getState().events },
    )

    applyRemoteRows({
      history: history.items,
      phrasebook: phrasebook.items,
      events: events.events,
    })
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
    queuedOptions = options
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
