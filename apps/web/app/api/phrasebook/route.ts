import { NextRequest, NextResponse } from 'next/server'
import type { PhrasebookEntry } from '@mindyourlanguage/shared'
import { requireUserId } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import { listPhrasebook, upsertPhrasebook } from '@/lib/db/phrasebook'

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
  const userIdOrResponse = await requireUserId()
  if (userIdOrResponse instanceof NextResponse) return userIdOrResponse
  if (!isDatabaseConfigured()) return syncNotConfigured()

  try {
    const items = await listPhrasebook(userIdOrResponse)
    return NextResponse.json({ items })
  } catch {
    return syncDatabaseError()
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const userIdOrResponse = await requireUserId()
  if (userIdOrResponse instanceof NextResponse) return userIdOrResponse
  if (!isDatabaseConfigured()) return syncNotConfigured()

  let body: { items?: PhrasebookEntry[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 })
  }

  try {
    const items = await upsertPhrasebook(userIdOrResponse, body.items)
    return NextResponse.json({ items })
  } catch {
    return syncDatabaseError()
  }
}
