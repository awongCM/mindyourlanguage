import type { Register, TranslateRequest } from '@mindyourlanguage/shared'

export interface NativeAlternativeResult {
  nativeAlternative: string
  register: Register
  note?: string
}

const REGISTER_LABELS: Record<Register, string> = {
  formal: '书面',
  casual: '口语',
  neutral: '中性',
}

const CHINESE_CHAR_RE = /[\u3400-\u9fff]/g

function isRegister(value: unknown): value is Register {
  return value === 'formal' || value === 'casual' || value === 'neutral'
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function differsFromPrimary(primary: string, alternative: string): boolean {
  return normalizeWhitespace(primary) !== normalizeWhitespace(alternative)
}

export function registerLabel(register: Register): string {
  return REGISTER_LABELS[register]
}

export function parseNativeAlternativeResponse(
  content: string,
): NativeAlternativeResult | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const data = parsed as Record<string, unknown>
  if (
    typeof data.nativeAlternative !== 'string' ||
    !data.nativeAlternative.trim() ||
    !isRegister(data.register)
  ) {
    return null
  }

  return {
    nativeAlternative: data.nativeAlternative.trim(),
    register: data.register,
    ...(typeof data.note === 'string' && data.note.trim()
      ? { note: data.note.trim() }
      : {}),
  }
}

export function shouldRequestNativeAlternative(
  request: Pick<
    TranslateRequest,
    'includeNativeAlternative' | 'sourceLang' | 'targetLang'
  >,
  translation: string,
): boolean {
  const chineseCharCount = translation.match(CHINESE_CHAR_RE)?.length ?? 0
  return (
    request.includeNativeAlternative === true &&
    request.sourceLang === 'en' &&
    request.targetLang === 'zh' &&
    chineseCharCount >= 2
  )
}
