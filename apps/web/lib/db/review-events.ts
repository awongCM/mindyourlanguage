import type { ReviewEvent } from '@mindyourlanguage/shared'
import { query } from '@/lib/db'
import {
  eventToReviewEventRow,
  reviewEventRowToEvent,
  type ReviewEventRow,
} from '@/lib/db/mappers'

export const DEFAULT_REVIEW_EVENTS_LIMIT = 500

export async function listReviewEvents(
  userId: string,
  limit = DEFAULT_REVIEW_EVENTS_LIMIT,
): Promise<ReviewEvent[]> {
  const rows = await query<ReviewEventRow>(
    `SELECT id, phrase_id, grade, reviewed_at, mode
     FROM review_events
     WHERE user_id = $1
     ORDER BY reviewed_at DESC
     LIMIT $2`,
    [userId, limit],
  )
  return rows.map(reviewEventRowToEvent)
}

export async function appendReviewEvents(
  userId: string,
  events: ReviewEvent[],
): Promise<ReviewEvent[]> {
  for (const event of events) {
    const row = eventToReviewEventRow(event)
    await query(
      `INSERT INTO review_events (id, user_id, phrase_id, grade, reviewed_at, mode)
       VALUES ($1, $2, $3, $4, $5::timestamptz, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id,
        userId,
        row.phrase_id,
        row.grade,
        row.reviewed_at,
        row.mode ?? 'self_grade',
      ],
    )
  }

  return listReviewEvents(userId)
}
