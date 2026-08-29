import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { parseCedictLine } from './parse-line'

export const DEFAULT_CEDICT_URL =
  'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz'

export const DEFAULT_CEDICT_USER_AGENT =
  'mindyourlanguage-cedict-import/1.0 (+https://github.com/awongCM/mindyourlanguage)'

const GZIP_MAGIC_0 = 0x1f
const GZIP_MAGIC_1 = 0x8b
const MIN_FILL_RATIO = 0.9

export interface CedictHeader {
  entries: number
  date: string | null
}

export type CedictSourceKind = 'primary' | 'fetched' | 'fallback'

export interface CedictSource {
  kind: CedictSourceKind
  path: string
}

export interface CedictSourcePaths {
  primaryTxt: string
  fallbackTxt: string
}

export interface ResolveCedictSourceOptions {
  fetchEnabled?: boolean
  download?: () => Promise<string>
}

export type CedictValidation =
  | { ok: true; parsed: number; declared: number }
  | { ok: false; reason: string }

export function parseCedictHeader(text: string): CedictHeader | null {
  const entriesMatch = text.match(/#!\s*entries=(\d+)/)
  if (!entriesMatch) return null
  const dateMatch = text.match(/#!\s*date=(\S+)/)
  return {
    entries: Number(entriesMatch[1]),
    date: dateMatch?.[1] ?? null,
  }
}

export function validateCedictText(text: string): CedictValidation {
  const header = parseCedictHeader(text)
  if (!header || header.entries < 1) {
    return { ok: false, reason: 'missing or invalid #! entries header' }
  }

  let parsed = 0
  for (const line of text.split(/\r?\n/)) {
    if (parseCedictLine(line)) parsed++
  }

  if (parsed / header.entries < MIN_FILL_RATIO) {
    return {
      ok: false,
      reason: `parsed ${parsed} entries, expected at least ${Math.ceil(header.entries * MIN_FILL_RATIO)} of ${header.entries}`,
    }
  }

  return { ok: true, parsed, declared: header.entries }
}

export function decodeCedictPayload(payload: Uint8Array): string {
  const buf = Buffer.from(payload)
  if (buf.length >= 2 && buf[0] === GZIP_MAGIC_0 && buf[1] === GZIP_MAGIC_1) {
    return gunzipSync(buf).toString('utf8')
  }
  return buf.toString('utf8')
}

export function isCedictFetchEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = env.CEDICT_FETCH?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

export const DEFAULT_CEDICT_FETCH_TIMEOUT_MS = 30_000

export async function downloadCedictText(options: {
  url?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
} = {}): Promise<string> {
  const url = options.url ?? DEFAULT_CEDICT_URL
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_CEDICT_FETCH_TIMEOUT_MS
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': DEFAULT_CEDICT_USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`CEDICT download failed: ${response.status}`)
  }
  const text = decodeCedictPayload(new Uint8Array(await response.arrayBuffer()))
  const validation = validateCedictText(text)
  if (!validation.ok) {
    throw new Error(`CEDICT download invalid: ${validation.reason}`)
  }
  return text
}

export async function resolveCedictSource(
  paths: CedictSourcePaths,
  options: ResolveCedictSourceOptions = {},
): Promise<CedictSource> {
  if (fs.existsSync(paths.primaryTxt)) {
    return { kind: 'primary', path: paths.primaryTxt }
  }

  const fetchEnabled = options.fetchEnabled ?? isCedictFetchEnabled()
  if (fetchEnabled && options.download) {
    try {
      const text = await options.download()
      const validation = validateCedictText(text)
      if (!validation.ok) {
        throw new Error(validation.reason)
      }
      fs.mkdirSync(path.dirname(paths.primaryTxt), { recursive: true })
      const tempPath = `${paths.primaryTxt}.${process.pid}.tmp`
      try {
        fs.writeFileSync(tempPath, text, 'utf8')
        fs.renameSync(tempPath, paths.primaryTxt)
      } catch (error) {
        try {
          fs.unlinkSync(tempPath)
        } catch {
          // Best-effort cleanup of a partial download.
        }
        throw error
      }
      return { kind: 'fetched', path: paths.primaryTxt }
    } catch {
      // Fall through to the archive so a network or payload failure cannot
      // block import when the repo fallback is present.
    }
  }

  if (fs.existsSync(paths.fallbackTxt)) {
    return { kind: 'fallback', path: paths.fallbackTxt }
  }

  throw new Error(
    'No CEDICT source found. Download to data/cedict.txt or keep legacy archive file.',
  )
}
