export interface CedictParsedLine {
  traditional: string
  simplified: string
  pinyin: string
  definitions: string[]
}

const LINE_RE = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/

export function parseCedictLine(line: string): CedictParsedLine | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const match = LINE_RE.exec(trimmed)
  if (!match) return null
  const [, traditional, simplified, pinyin, defs] = match
  const definitions = defs
    .split('/')
    .map((d) => d.trim())
    .filter(Boolean)
  if (definitions.length === 0) return null
  return { traditional, simplified, pinyin, definitions }
}
