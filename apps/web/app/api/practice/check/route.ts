import { NextRequest, NextResponse } from 'next/server'
import {
  checkUserAttempt,
  isCheckAttemptAvailable,
} from '@/lib/practice/check-attempt'
import {
  checkRateLimit,
  clientIpFromForwardedFor,
} from '@/lib/rate-limit'
import type { CheckAttemptRequest } from '@mindyourlanguage/shared'

export async function GET() {
  return NextResponse.json({ available: isCheckAttemptAvailable() })
}

export async function POST(req: NextRequest) {
  if (!isCheckAttemptAvailable()) {
    return NextResponse.json(
      { error: 'Check attempt unavailable' },
      { status: 503 },
    )
  }

  let body: CheckAttemptRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.userAttempt?.trim() || !body.primaryTranslation?.trim()) {
    return NextResponse.json(
      { error: 'userAttempt and primaryTranslation are required' },
      { status: 400 },
    )
  }

  const ip = clientIpFromForwardedFor(req.headers.get('x-forwarded-for'))
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const result = await checkUserAttempt({
    sourceText: body.sourceText?.trim() ?? '',
    userAttempt: body.userAttempt.trim(),
    primaryTranslation: body.primaryTranslation.trim(),
    nativeAlternative: body.nativeAlternative?.trim() || undefined,
  })

  if (!result) {
    return NextResponse.json(
      { error: 'Check attempt unavailable' },
      { status: 502 },
    )
  }

  return NextResponse.json(result)
}
