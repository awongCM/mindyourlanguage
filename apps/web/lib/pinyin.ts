import { pinyin } from 'pinyin-pro'

export function toPinyin(text: string): string {
  return pinyin(text, { toneType: 'symbol', type: 'array' }).join(' ')
}

/** Phase 1: character-level segments. Word-level segmentation arrives in Phase 2 (CEDICT). */
export function segmentChinese(text: string): { text: string; pinyin: string }[] {
  const chars = [...text]
  return chars
    .filter((c) => /[\u4e00-\u9fff]/.test(c))
    .map((c) => ({ text: c, pinyin: pinyin(c, { toneType: 'symbol' }) }))
}
