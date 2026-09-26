import { toast } from 'sonner'
import { useHistoryStore } from '@/lib/stores/history'
import { usePhrasebookStore } from '@/lib/stores/phrasebook'
import { useReviewEventsStore } from '@/lib/stores/review-events'

type Identifiable = { id: string }

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

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`Sync request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export async function syncAllStores(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const historyItems = useHistoryStore.getState().items
    const historyPut = await fetch('/api/history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: historyItems }),
    })
    const historyPutBody = await readJson<{ items: typeof historyItems }>(
      historyPut,
    )

    const phrasebookItems = usePhrasebookStore.getState().items
    const phrasebookPut = await fetch('/api/phrasebook', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: phrasebookItems }),
    })
    const phrasebookPutBody = await readJson<{ items: typeof phrasebookItems }>(
      phrasebookPut,
    )

    const reviewEvents = useReviewEventsStore.getState().events
    const eventsPost = await fetch('/api/review-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: reviewEvents }),
    })
    await readJson<{ events: typeof reviewEvents }>(eventsPost)

    const historyGet = await fetch('/api/history')
    const historyGetBody = await readJson<{ items: typeof historyItems }>(
      historyGet,
    )
    useHistoryStore.setState({
      items: mergeById(historyPutBody.items, historyGetBody.items, (row) =>
        row.createdAt,
      ),
    })

    const phrasebookGet = await fetch('/api/phrasebook')
    const phrasebookGetBody = await readJson<{ items: typeof phrasebookItems }>(
      phrasebookGet,
    )
    usePhrasebookStore.setState({
      items: mergeById(
        phrasebookPutBody.items,
        phrasebookGetBody.items,
        (row) => row.createdAt,
      ),
    })

    const eventsGet = await fetch('/api/review-events')
    const eventsGetBody = await readJson<{ events: typeof reviewEvents }>(
      eventsGet,
    )
    useReviewEventsStore.setState({
      events: mergeById(reviewEvents, eventsGetBody.events, (row) =>
        row.reviewedAt,
      ),
    })
  } catch {
    toast.error('Cloud sync failed — using local data')
  }
}
