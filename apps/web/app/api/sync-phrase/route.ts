import { NextRequest, NextResponse } from 'next/server'
import { resolveSyncUser } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import {
  beginSyncPhraseAttempt,
  findUserIdFromSyncPhraseCookie,
  openPreparedSyncPhrase,
  savePreparedSyncPhrase,
} from '@/lib/sync-phrase'
import { readSyncBody } from '@/lib/sync/read-body'

function syncNotConfigured(): NextResponse {
  return NextResponse.json(
    { error: 'Cloud sync is not configured' },
    { status: 501 },
  )
}

export async function GET(): Promise<NextResponse> {
  if (!isDatabaseConfigured()) return syncNotConfigured()

  try {
    const userId = await findUserIdFromSyncPhraseCookie()
    return NextResponse.json({ linked: Boolean(userId) })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 503 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isDatabaseConfigured()) return syncNotConfigured()

  const read = await readSyncBody(req)
  if (!read.ok) return read.response

  const phrase = typeof read.body.phrase === 'string' ? read.body.phrase : ''
  const action = read.body.action
  if (action !== 'save' && action !== 'open') {
    return NextResponse.json(
      { error: 'Choose save or open.' },
      { status: 400 },
    )
  }

  try {
    const started = await beginSyncPhraseAttempt(phrase)
    if (!started.ok) {
      return NextResponse.json(
        { error: started.error },
        { status: started.status },
      )
    }

    if (action === 'open') {
      const opened = await openPreparedSyncPhrase(started.phrase)
      if (!opened.ok) {
        return NextResponse.json(
          { error: opened.error },
          { status: opened.status },
        )
      }
      return NextResponse.json({ linked: true })
    }

    const resolution = await resolveSyncUser({ create: true })
    if (resolution.kind === 'rate_limited') {
      return NextResponse.json(
        { error: 'Too many attempts. Wait a moment.' },
        { status: 429 },
      )
    }
    if (resolution.kind !== 'user') {
      return NextResponse.json({ error: 'Database error' }, { status: 503 })
    }

    const saved = await savePreparedSyncPhrase(
      resolution.userId,
      started.phrase,
    )
    if (!saved.ok) {
      return NextResponse.json({ error: saved.error }, { status: saved.status })
    }
    return NextResponse.json({ linked: true })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 503 })
  }
}
