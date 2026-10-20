import { NextRequest, NextResponse } from 'next/server'
import type { TranslationRecord } from '@mindyourlanguage/shared'
import { resolveSyncUser } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import { listHistory, upsertHistory } from '@/lib/db/history'

function syncNotConfigured(): NextResponse {
  return NextResponse.json(
    { error: 'Cloud sync is not configured' },
    { status: 501 },
  )
}

function syncDatabaseError(): NextResponse {
  return NextResponse.json({ error: 'Database error' }, { status: 503 })
}

export async function GET(): Promise<NextResponse> {
  if (!isDatabaseConfigured()) return syncNotConfigured()

  try {
    const resolution = await resolveSyncUser({ create: false })
    if (resolution.kind !== 'user') return NextResponse.json({ items: [] })

    const items = await listHistory(resolution.userId)
    return NextResponse.json({ items })
  } catch {
    return syncDatabaseError()
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  if (!isDatabaseConfigured()) return syncNotConfigured()

  let body: { items?: TranslationRecord[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 })
  }

  try {
    const resolution = await resolveSyncUser({ create: body.items.length > 0 })
    if (resolution.kind === 'rate_limited') {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (resolution.kind === 'none') return NextResponse.json({ items: [] })

    const items = await upsertHistory(resolution.userId, body.items)
    return NextResponse.json({ items })
  } catch {
    return syncDatabaseError()
  }
}
