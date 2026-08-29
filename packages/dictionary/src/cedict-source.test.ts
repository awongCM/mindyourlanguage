import { gzipSync } from 'node:zlib'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_CEDICT_URL,
  DEFAULT_CEDICT_USER_AGENT,
  decodeCedictPayload,
  downloadCedictText,
  isCedictFetchEnabled,
  parseCedictHeader,
  resolveCedictSource,
  validateCedictText,
} from './cedict-source'

const VALID_DUMP = `# CC-CEDICT
#! version=1
#! entries=2
#! date=2026-08-25T08:12:38Z
認識 认识 [ren4 shi5] /to know/to recognize/
你好 你好 [ni3 hao3] /hello/hi/
`

function gzipped(text: string): Uint8Array {
  return gzipSync(Buffer.from(text, 'utf8'))
}

describe('parseCedictHeader', () => {
  it('reads entries and date from a CC-CEDICT header', () => {
    expect(parseCedictHeader(VALID_DUMP)).toEqual({
      entries: 2,
      date: '2026-08-25T08:12:38Z',
    })
  })

  it('returns null when the entries header is missing', () => {
    expect(parseCedictHeader('# CC-CEDICT\n你好 你好 [ni3 hao3] /hello/\n')).toBeNull()
  })
})

describe('validateCedictText', () => {
  it('accepts a dump whose parsed rows match the header count', () => {
    const result = validateCedictText(VALID_DUMP)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.parsed).toBe(2)
      expect(result.declared).toBe(2)
    }
  })

  it('rejects HTML or other non-CEDICT payloads', () => {
    expect(validateCedictText('<html>not a dictionary</html>').ok).toBe(false)
  })

  it('rejects a truncated dump whose parsed rows are far below the header', () => {
    const truncated = VALID_DUMP.replace('#! entries=2', '#! entries=100000')
    expect(validateCedictText(truncated).ok).toBe(false)
  })
})

describe('decodeCedictPayload', () => {
  it('gunzips a gzip payload', () => {
    expect(decodeCedictPayload(gzipped(VALID_DUMP))).toBe(VALID_DUMP)
  })

  it('returns utf8 text when the payload is uncompressed', () => {
    expect(decodeCedictPayload(Buffer.from(VALID_DUMP, 'utf8'))).toBe(VALID_DUMP)
  })
})

describe('isCedictFetchEnabled', () => {
  afterEach(() => {
    delete process.env.CEDICT_FETCH
  })

  it('is false by default so local import stays offline', () => {
    delete process.env.CEDICT_FETCH
    expect(isCedictFetchEnabled()).toBe(false)
  })

  it('is true for 1, true, and yes', () => {
    process.env.CEDICT_FETCH = '1'
    expect(isCedictFetchEnabled()).toBe(true)
    process.env.CEDICT_FETCH = 'true'
    expect(isCedictFetchEnabled()).toBe(true)
    process.env.CEDICT_FETCH = 'YES'
    expect(isCedictFetchEnabled()).toBe(true)
  })
})

describe('resolveCedictSource', () => {
  let tmp = ''

  afterEach(() => {
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  function makePaths() {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cedict-source-'))
    return {
      primaryTxt: path.join(tmp, 'cedict.txt'),
      fallbackTxt: path.join(tmp, 'archive.txt'),
    }
  }

  it('prefers an existing local data/cedict.txt over fetch and archive', async () => {
    const paths = makePaths()
    fs.writeFileSync(paths.primaryTxt, VALID_DUMP)
    fs.writeFileSync(paths.fallbackTxt, VALID_DUMP)
    const source = await resolveCedictSource(paths, {
      fetchEnabled: true,
      download: async () => {
        throw new Error('should not fetch')
      },
    })
    expect(source).toEqual({ kind: 'primary', path: paths.primaryTxt })
  })

  it('downloads, validates, and writes data/cedict.txt when fetch is enabled', async () => {
    const paths = makePaths()
    fs.writeFileSync(paths.fallbackTxt, VALID_DUMP)
    const source = await resolveCedictSource(paths, {
      fetchEnabled: true,
      download: async () => VALID_DUMP,
    })
    expect(source).toEqual({ kind: 'fetched', path: paths.primaryTxt })
    expect(fs.readFileSync(paths.primaryTxt, 'utf8')).toBe(VALID_DUMP)
  })

  it('falls back to the archive file when fetch fails', async () => {
    const paths = makePaths()
    fs.writeFileSync(paths.fallbackTxt, VALID_DUMP)
    const source = await resolveCedictSource(paths, {
      fetchEnabled: true,
      download: async () => {
        throw new Error('network down')
      },
    })
    expect(source).toEqual({ kind: 'fallback', path: paths.fallbackTxt })
    expect(fs.existsSync(paths.primaryTxt)).toBe(false)
  })

  it('falls back to the archive when the download does not validate', async () => {
    const paths = makePaths()
    fs.writeFileSync(paths.fallbackTxt, VALID_DUMP)
    const source = await resolveCedictSource(paths, {
      fetchEnabled: true,
      download: async () => '<html>blocked</html>',
    })
    expect(source).toEqual({ kind: 'fallback', path: paths.fallbackTxt })
  })

  it('uses the archive when fetch is disabled', async () => {
    const paths = makePaths()
    fs.writeFileSync(paths.fallbackTxt, VALID_DUMP)
    const source = await resolveCedictSource(paths, { fetchEnabled: false })
    expect(source).toEqual({ kind: 'fallback', path: paths.fallbackTxt })
  })

  it('throws when no source is available', async () => {
    const paths = makePaths()
    await expect(
      resolveCedictSource(paths, { fetchEnabled: false }),
    ).rejects.toThrow(/No CEDICT source found/)
  })
})

describe('DEFAULT_CEDICT_URL', () => {
  it('points at the official MDBG gzip export', () => {
    expect(DEFAULT_CEDICT_URL).toContain('mdbg.net')
    expect(DEFAULT_CEDICT_URL).toMatch(/\.txt\.gz$/)
  })
})

describe('downloadCedictText', () => {
  it('fetches the MDBG gzip export with a real User-Agent', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init })
      return new Response(gzipped(VALID_DUMP), {
        status: 200,
        headers: { 'Content-Type': 'application/gzip' },
      })
    }

    const text = await downloadCedictText({ fetchImpl })

    expect(text).toBe(VALID_DUMP)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(DEFAULT_CEDICT_URL)
    const headers = new Headers(calls[0].init?.headers)
    expect(headers.get('User-Agent')).toBe(DEFAULT_CEDICT_USER_AGENT)
  })

  it('throws when the HTTP response is not ok', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('nope', { status: 403 })
    await expect(downloadCedictText({ fetchImpl })).rejects.toThrow(
      /CEDICT download failed: 403/,
    )
  })

  it('throws when the payload is not a valid CEDICT dump', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('<html>blocked</html>', { status: 200 })
    await expect(downloadCedictText({ fetchImpl })).rejects.toThrow(
      /CEDICT download invalid/,
    )
  })
})
