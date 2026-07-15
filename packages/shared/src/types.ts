export type Lang = 'en' | 'zh'
export type CharacterSet = 'simplified' | 'traditional'
export type VoiceRegion = 'zh-CN' | 'zh-TW'
export type Register = 'formal' | 'casual' | 'neutral'

export interface DictionaryEntry {
  simplified: string
  traditional: string
  pinyin: string
  definitions: string[]
}

export interface TranslationSegment {
  text: string
  pinyin: string
}

export interface TranslationRecord {
  id: string
  userId: string | null
  sourceText: string
  sourceLang: Lang
  targetLang: Lang
  translation: string
  traditional?: string
  pinyin?: string
  characterSet: CharacterSet
  register?: Register
  nativeAlternative?: string
  dictionaryMatches: DictionaryEntry[]
  segments: TranslationSegment[]
  createdAt: string
}

export interface PhrasebookEntry {
  id: string
  translationId: string | null
  sourceText: string
  sourceLang: Lang
  targetLang: Lang
  translation: string
  traditional?: string
  pinyin?: string
  characterSet: CharacterSet
  nativeAlternative?: string
  tags: string[]
  notes: string
  createdAt: string
}

export interface TranslateRequest {
  text: string
  sourceLang: Lang
  targetLang: Lang
  characterSet: CharacterSet
  includeNativeAlternative?: boolean
  voiceRegion?: VoiceRegion
}

export interface TranslateResponse {
  id: string
  translation: string
  traditional?: string
  pinyin?: string
  detectedLang: Lang
  segments: TranslationSegment[]
  dictionaryMatches: DictionaryEntry[]
  nativeAlternative?: string
  register?: Register
  nativeNote?: string
}
