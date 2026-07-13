import { NextRequest, NextResponse } from 'next/server'
import { translateText } from '@/lib/deepl'
import { enrichChineseTranslation } from '@/lib/enrich-translation'
import {
  checkRateLimit,
  clientIpFromForwardedFor,
} from '@/lib/rate-limit'
import type { Lang, TranslateRequest } from '@mindyourlanguage/shared'
import { randomUUID } from 'crypto'

const MAX_CHARS = 500
const VALID_LANGS: Lang[] = ['en', 'zh']

export async function POST(req: NextRequest) {
  let body: TranslateRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.text?.trim()) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }
  if (body.text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Text exceeds ${MAX_CHARS} characters` },
      { status: 400 },
    )
  }
  if (
    !VALID_LANGS.includes(body.sourceLang) ||
    !VALID_LANGS.includes(body.targetLang)
  ) {
    return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
  }

  const ip = clientIpFromForwardedFor(req.headers.get('x-forwarded-for'))
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { text } = await translateText(
      body.text,
      body.sourceLang,
      body.targetLang,
    )
    const enrichment =
      body.targetLang === 'zh' ? enrichChineseTranslation(text) : undefined

    return NextResponse.json({
      id: randomUUID(),
      translation: text,
      detectedLang: body.sourceLang,
      segments: enrichment?.segments ?? [],
      dictionaryMatches: enrichment?.dictionaryMatches ?? [],
      ...(enrichment
        ? { pinyin: enrichment.pinyin, traditional: enrichment.traditional }
        : {}),
    })
  } catch {
    return NextResponse.json(
      { error: 'Translation service unavailable' },
      { status: 502 },
    )
  }
}
