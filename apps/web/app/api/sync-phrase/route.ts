import { NextRequest, NextResponse } from 'next/server'
import type {
  PhrasebookEntry,
  ReviewEvent,
  TranslationRecord,
} from '@mindyourlanguage/shared'
import { resolveAnonUser } from '@/lib/anon-identity'
import { resolveSyncUser } from '@/lib/auth-session'
import { isDatabaseConfigured } from '@/lib/db'
import { upsertHistory } from '@/lib/db/history'
import { upsertPhrasebook } from '@/lib/db/phrasebook'
import { appendReviewEvents } from '@/lib/db/review-events'
import { findUserIdBySyncKeyHash } from '@/lib/db/users'
import {
  beginSyncPhraseAttempt,
  findUserIdFromSyncPhraseCookie,
  forgetSyncPhrase,
  hashSyncPhrase,
  openPreparedSyncPhrase,
  PHRASE_TAKEN,
  savePreparedSyncPhrase,
  TOO_MANY,
} from '@/lib/sync-phrase'
import {
  HISTORY_SYNC_MAX_ITEMS,
  PayloadTooLargeError,
  PHRASEBOOK_MAX_ITEMS,
  REVIEW_EVENTS_SYNC_MAX,
} from '@/lib/sync/limits'
import { payloadTooLarge, readSyncBody } from '@/lib/sync/read-body'

function syncNotConfigured(): NextResponse {
  return NextResponse.json(
    { error: 'Cloud sync is not configured' },
    { status: 501 },
  )
}

/** Rows this browser is showing. Missing keys mean "none", not "invalid". */
function readShownRows(body: Record<string, unknown>):
  | {
      ok: true
      phrasebook: unknown[]
      history: unknown[]
      events: unknown[]
    }
  | { ok: false; response: NextResponse } {
  const phrasebook = readShownList(body.phrasebook, PHRASEBOOK_MAX_ITEMS)
  const history = readShownList(body.history, HISTORY_SYNC_MAX_ITEMS)
  const events = readShownList(body.events, REVIEW_EVENTS_SYNC_MAX)
  if (
    phrasebook === 'invalid' ||
    history === 'invalid' ||
    events === 'invalid'
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Shown rows must be arrays.' },
        { status: 400 },
      ),
    }
  }
  if (
    phrasebook === 'too-large' ||
    history === 'too-large' ||
    events === 'too-large'
  ) {
    return { ok: false, response: payloadTooLarge() }
  }
  return { ok: true, phrasebook, history, events }
}

function readShownList(
  value: unknown,
  max: number,
): unknown[] | 'invalid' | 'too-large' {
  if (value === undefined) return []
  if (!Array.isArray(value)) return 'invalid'
  if (value.length > max) return 'too-large'
  return value
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

    const shown = readShownRows(read.body)
    if (!shown.ok) return shown.response

    const ownerId = await findUserIdBySyncKeyHash(hashSyncPhrase(started.phrase))
    let resolution = await resolveSyncUser({ create: false })
    if (resolution.kind === 'rate_limited') {
      return NextResponse.json({ error: TOO_MANY }, { status: 429 })
    }
    // An empty browser must not create a user and claim a phrase. A browser
    // that is showing phrases may store those rows and then link the phrase,
    // including when they exist only on that device and no cookie was sent.
    if (
      ownerId &&
      (resolution.kind !== 'user' || ownerId !== resolution.userId)
    ) {
      return NextResponse.json({ error: PHRASE_TAKEN }, { status: 409 })
    }
    if (resolution.kind !== 'user') {
      if (shown.phrasebook.length === 0) {
        return NextResponse.json(
          {
            error:
              'Save the phrase in the browser that already shows your phrases.',
          },
          { status: 400 },
        )
      }
      resolution = await resolveAnonUser({ create: true })
      if (resolution.kind === 'rate_limited') {
        return NextResponse.json({ error: TOO_MANY }, { status: 429 })
      }
      if (resolution.kind !== 'user') {
        return NextResponse.json({ error: 'Database error' }, { status: 503 })
      }
    }

    try {
      if (shown.history.length > 0) {
        await upsertHistory(
          resolution.userId,
          shown.history as TranslationRecord[],
          [],
        )
      }
      if (shown.phrasebook.length > 0) {
        await upsertPhrasebook(
          resolution.userId,
          shown.phrasebook as PhrasebookEntry[],
          [],
        )
      }
      if (shown.events.length > 0) {
        await appendReviewEvents(
          resolution.userId,
          shown.events as ReviewEvent[],
        )
      }
    } catch (error) {
      if (error instanceof PayloadTooLargeError) return payloadTooLarge()
      throw error
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
