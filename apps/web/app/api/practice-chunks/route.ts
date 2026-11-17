import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fetchPracticeChunks } from '@/lib/practice-chunks'
import {
  checkRateLimitForKey,
  clientIpFromForwardedFor,
} from '@/lib/rate-limit'
import type { PracticeChunksRequest, VoiceRegion } from '@mindyourlanguage/shared'

const MAX_CHARS = 1000

export async function POST(req: NextRequest) {
  let body: PracticeChunksRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.sourceText?.trim() || !body.translation?.trim()) {
    return NextResponse.json(
      { error: 'sourceText and translation are required' },
      { status: 400 },
    )
  }
  if (
    body.sourceText.length > MAX_CHARS ||
    body.translation.length > MAX_CHARS
  ) {
    return NextResponse.json(
      { error: `Text exceeds ${MAX_CHARS} characters` },
      { status: 400 },
    )
  }

  const session = await auth()
  const rateKey = session?.user?.id
    ? `user:${session.user.id}`
    : `ip:${clientIpFromForwardedFor(req.headers.get('x-forwarded-for'))}`
  if (!checkRateLimitForKey(rateKey)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const voiceRegion: VoiceRegion =
    body.voiceRegion === 'zh-TW' ? 'zh-TW' : 'zh-CN'

  try {
    const items = await fetchPracticeChunks({
      sourceText: body.sourceText.trim(),
      translation: body.translation.trim(),
      voiceRegion,
      characterSet: body.characterSet,
    })
    return NextResponse.json({ items })
  } catch (err) {
    console.error('practice-chunks failed', err)
    return NextResponse.json({ items: [] })
  }
}