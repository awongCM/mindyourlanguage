import { describe, expect, it } from 'vitest'
import { readSyncBody } from './read-body'
import { SYNC_MAX_BODY_BYTES } from './limits'

function request(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/x', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
}

describe('readSyncBody', () => {
  it('parses a JSON object body', async () => {
    const result = await readSyncBody(request('{"items":[]}'))
    expect(result).toEqual({ ok: true, body: { items: [] } })
  })

  it('returns 413 when content-length is over the limit, without reading the body', async () => {
    const req = request('{}', {
      'content-length': String(SYNC_MAX_BODY_BYTES + 1),
    })
    const result = await readSyncBody(req)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(413)
    await expect(result.response.json()).resolves.toEqual({
      error: 'Payload too large',
    })
    expect(req.bodyUsed).toBe(false)
  })

  it('returns 413 when the actual body is over the limit (no content-length)', async () => {
    const result = await readSyncBody(request('x'.repeat(101)), 100)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(413)
  })

  it('counts bytes, not characters', async () => {
    // 60 x 3-byte characters = 180 bytes > 100, but only 60 chars.
    const result = await readSyncBody(request('你'.repeat(60)), 100)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(413)
  })

  it('returns 400 for unparseable JSON', async () => {
    const result = await readSyncBody(request('{nope'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(400)
  })

  it('returns 400 when the JSON is not an object', async () => {
    for (const text of ['null', '[]', '"s"', '3']) {
      const result = await readSyncBody(request(text))
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.response.status).toBe(400)
    }
  })
})
