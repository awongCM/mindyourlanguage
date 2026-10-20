import { NextRequest, NextResponse } from 'next/server'
import type { ReviewEvent } from '@mindyourlanguage/shared'
import { resolveSyncUser } from '@/lib/auth-session'
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
  if (!isDatabaseConfigured()) return syncNotConfigured()

  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = limitParam
    ? Number.parseInt(limitParam, 10)
    : DEFAULT_REVIEW_EVENTS_LIMIT
  const safeLimit =
    Number.isFinite(limit) && limit > 0
      ? Math.min(limit, 1000)
      : DEFAULT_REVIEW_EVENTS_LIMIT

  try {
    const resolution = await resolveSyncUser({ create: false })
    if (resolution.kind !== 'user') return NextResponse.json({ events: [] })

    const events = await listReviewEvents(resolution.userId, safeLimit)
    return NextResponse.json({ events })
  } catch {
    return syncDatabaseError()
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
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
    const resolution = await resolveSyncUser({ create: body.events.length > 0 })
    if (resolution.kind === 'rate_limited') {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (resolution.kind === 'none') return NextResponse.json({ events: [] })

    const events = await appendReviewEvents(resolution.userId, body.events)
    return NextResponse.json({ events })
  } catch {
    return syncDatabaseError()
  }
}
