import { HISTORY_MAX } from '@/lib/stores/history'
import { REVIEW_EVENTS_MAX } from '@/lib/stores/review-events'

/** Whole request body. A phrasebook entry with segments/dictionary matches is ~1–3 KB. */
export const SYNC_MAX_BODY_BYTES = 5_000_000
/** History PUT: client sends ≤ 50; allow slack, server still slices to HISTORY_MAX. */
export const HISTORY_SYNC_MAX_ITEMS = HISTORY_MAX * 4
/** Phrasebook: per request and per user. */
export const PHRASEBOOK_MAX_ITEMS = 2_000
/** Review events per POST (client cap). */
export const REVIEW_EVENTS_SYNC_MAX = REVIEW_EVENTS_MAX
/** Server keeps at most this many review events per user (trim oldest). */
export const REVIEW_EVENTS_SERVER_MAX = 5_000
/** deletedIds per request. */
export const SYNC_MAX_DELETED_IDS = PHRASEBOOK_MAX_ITEMS

/** Thrown by the DB layer when a per-user cap would be exceeded; routes answer 413. */
export class PayloadTooLargeError extends Error {
  constructor(message = 'Payload too large') {
    super(message)
    this.name = 'PayloadTooLargeError'
  }
}
