export type Lang = 'en' | 'zh'
export type CharacterSet = 'simplified' | 'traditional'
export type VoiceRegion = 'zh-CN' | 'zh-TW'
export type Register = 'formal' | 'casual' | 'neutral'
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy'
export type CheckAttemptVerdict = 'close' | 'partial' | 'off'

export interface PracticeStats {
  easeFactor: number
  intervalDays: number
  repetitions: number
  nextReviewAt: string
  lastReviewedAt?: string
}

export type ReviewEventMode = 'self_grade'

export interface ReviewEvent {
  id: string
  phraseId: string
  grade: ReviewGrade
  reviewedAt: string
  mode: ReviewEventMode
}

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
  nativeNote?: string
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
  register?: Register
  nativeAlternative?: string
  nativeNote?: string
  dictionaryMatches: DictionaryEntry[]
  segments: TranslationSegment[]
  tags: string[]
  notes: string
  createdAt: string
  practiceStats?: PracticeStats
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
  spokenPinyin?: string
  detectedLang: Lang
  segments: TranslationSegment[]
  dictionaryMatches: DictionaryEntry[]
  nativeAlternative?: string
  register?: Register
  nativeNote?: string
}

export interface CheckAttemptRequest {
  sourceText: string
  userAttempt: string
  primaryTranslation: string
  nativeAlternative?: string
}

export interface CheckAttemptResponse {
  verdict: CheckAttemptVerdict
  feedback: string
  corrections?: string[]
  betterPhrasing?: string
}
