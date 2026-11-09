import { NextRequest, NextResponse } from 'next/server'
import { resolveSyncUser } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import {
  beginSyncPhraseAttempt,
  findUserIdFromSyncPhraseCookie,
  forgetSyncPhrase,
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
  if (action !== 'save' && action !== 'open' && action !== 'forget') {
    return NextResponse.json(
      { error: 'Choose save or open.' },
      { status: 400 },
    )
  }

  try {
    if (action === 'forget') {
      await forgetSyncPhrase()
      return NextResponse.json({ linked: false })
    }

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

    const resolution = await resolveSyncUser({ create: false })
    if (resolution.kind !== 'user') {
      return NextResponse.json(
        {
          error:
            'Save the phrase in the browser that already shows your phrases.',
        },
        { status: 400 },
      )
    }

    const saved = await savePreparedSyncPhrase(
      resolution.userId,
      started.phrase,
    )
    if (!saved.ok) {
      return NextResponse.json({ error: saved.error }, { status: saved.status })
    }
    return NextResponse.json({ linked: true, replaced: Boolean(saved.replaced) })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 503 })
  }
}
