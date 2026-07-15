import { NextResponse } from 'next/server'
import { getDictionaryDb } from '@mindyourlanguage/dictionary'

export async function GET() {
  const cedict = getDictionaryDb() !== null
  const deeplConfigured = Boolean(process.env.DEEPL_API_KEY?.trim())
  const ok = cedict && deeplConfigured

  return NextResponse.json(
    { ok, cedict, deeplConfigured },
    { status: ok ? 200 : 503 },
  )
}
