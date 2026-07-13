import { toTraditionalChars } from './characters'
import { segmentChinese, toPinyin } from './pinyin'

export function enrichChineseTranslation(translation: string): {
  pinyin: string
  traditional: string
  segments: { text: string; pinyin: string }[]
} {
  return {
    pinyin: toPinyin(translation),
    traditional: toTraditionalChars(translation),
    segments: segmentChinese(translation),
  }
}
