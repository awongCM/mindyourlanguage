import { NextRequest, NextResponse } from 'next/server'
import type { ReviewEvent } from '@mindyourlanguage/shared'
import { requireUserId } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import {
  appendReviewEvents,
  DEFAULT_REVIEW_EVENTS_LIMIT,
  listReviewEvents,
} from '@/lib/db/review-events'

function syncNotConfigured(): NextResponse {
  return NextResponse.json(
    { error: 'Cloud sync is not configured' },
    { status: 501 },
  )
}

function syncDatabaseError(): NextResponse {
  return NextResponse.json({ error: 'Database error' }, { status: 503 })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userIdOrResponse = await requireUserId()
  if (userIdOrResponse instanceof NextResponse) return userIdOrResponse
  if (!isDatabaseConfigured()) return syncNotConfigured()

  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = limitParam
    ? Number.parseInt(limitParam, 10)
    : DEFAULT_REVIEW_EVENTS_LIMIT
  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1000) : DEFAULT_REVIEW_EVENTS_LIMIT

  try {
    const events = await listReviewEvents(userIdOrResponse, safeLimit)
    return NextResponse.json({ events })
  } catch {
    return syncDatabaseError()
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userIdOrResponse = await requireUserId()
  if (userIdOrResponse instanceof NextResponse) return userIdOrResponse
  if (!isDatabaseConfigured()) return syncNotConfigured()

  let body: { events?: ReviewEvent[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.events)) {
    return NextResponse.json({ error: 'events array required' }, { status: 400 })
  }

  try {
    const events = await appendReviewEvents(userIdOrResponse, body.events)
    return NextResponse.json({ events })
  } catch {
    return syncDatabaseError()
  }
}
