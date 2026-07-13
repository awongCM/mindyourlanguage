import { NextResponse, type NextRequest } from 'next/server'
import { lookupTerm } from '@mindyourlanguage/dictionary'

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 20

export async function GET(req: NextRequest | Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  if (!q) {
    return NextResponse.json({ error: 'q is required' }, { status: 400 })
  }

  const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.floor(rawLimit)), MAX_LIMIT)
    : DEFAULT_LIMIT

  try {
    const entries = lookupTerm(q, limit)
    return NextResponse.json({ entries })
  } catch (err) {
    console.error('dictionary lookup failed', err)
    return NextResponse.json({ entries: [] })
  }
}
