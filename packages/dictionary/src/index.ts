export { parseCedictLine } from './parse-line'
export type { CedictParsedLine } from './parse-line'
export { lookupTerm, setDictionaryDbPathForTests } from './lookup'
export { getDictionaryDb, resolveDictionaryDbPath } from './db'
export { clearSegmentCacheForTests, segment } from './segment'
export {
  DEFAULT_CEDICT_URL,
  downloadCedictText,
  isCedictFetchEnabled,
  parseCedictHeader,
  resolveCedictSource,
  validateCedictText,
} from './cedict-source'
export type {
  CedictHeader,
  CedictSource,
  CedictSourceKind,
} from './cedict-source'
