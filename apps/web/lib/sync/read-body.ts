import { NextResponse } from 'next/server'
import { SYNC_MAX_BODY_BYTES } from '@/lib/sync/limits'

export function payloadTooLarge(): NextResponse {
  return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
}

export type SyncBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: NextResponse }

/**
 * Read a sync request body with a size cap.
 *
 * 413 when `content-length` or the actual byte length is over `maxBytes`
 * (the second check covers chunked bodies with no `content-length`);
 * 400 when the body is not a JSON object.
 */
export async function readSyncBody(
  req: Request,
  maxBytes: number = SYNC_MAX_BODY_BYTES,
): Promise<SyncBodyResult> {
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: payloadTooLarge() }
  }

  let text: string
  try {
    text = await req.text()
  } catch {
    return { ok: false, response: invalidBody() }
  }
  if (Buffer.byteLength(text) > maxBytes) {
    return { ok: false, response: payloadTooLarge() }
  }

  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, response: invalidBody() }
    }
    return { ok: true, body: parsed as Record<string, unknown> }
  } catch {
    return { ok: false, response: invalidBody() }
  }
}

function invalidBody(): NextResponse {
  return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
}
