import type { DictionaryEntry } from '@mindyourlanguage/shared'

export const GROUNDING_PREVIEW_COUNT = 15
export const MAX_SEGMENT_LOOKUPS = 250
export const MAX_CURATED_MATCHES = 80

const COMMON_SINGLE_CHARS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '这', '他', '中',
  '大', '为', '上', '个', '国', '们', '到', '说', '时', '要', '也', '你', '对',
  '生', '能', '而', '子', '那', '得', '于', '着', '下', '自', '之', '年', '过',
  '后', '作', '里', '用', '道', '行', '所', '然', '家', '种', '事', '成', '方',
  '多', '经', '么', '去', '法', '学', '同', '现', '当', '没', '看', '好', '还',
  '分', '但', '把', '被', '从', '以', '及', '与', '或', '很', '更', '最', '都',
  '再', '又', '将', '已', '并', '等', '其', '此', '每', '各', '某', '另', '该',
  '本', '些', '几', '如', '若', '则', '且', '因', '让', '给', '向', '往', '由',
  '按', '据', '称', '日', '月', '天', '地', '来', '去', '出', '入', '会', '可',
  '应', '该', '将', '对', '将', '与', '之', '于',
])

const COMMON_WORDS = new Set([
  '一个', '一些', '可以', '已经', '进行', '通过', '对于', '因为', '所以', '如果',
  '没有', '不是', '什么', '怎么', '我们', '他们', '它们', '这个', '那个', '以及',
  '其中', '目前', '根据', '有关', '相关', '由于', '于是', '然而', '但是', '而且',
  '并且', '或者', '还是', '就是', '也是', '都是', '应该', '需要', '可能', '一定',
  '一般', '一直', '一起', '一下', '一种', '一次', '今天', '昨天', '明天', '时候',
  '地方', '自己', '大家', '你们', '她们', '如何', '为什么', '这样', '那样', '这种',
  '那种', '此外', '已经', '正在', '将会', '不会', '不能', '不要', '还有', '还有',
])

export interface GroundingMatchCandidate {
  segmentText: string
  position: number
  entry: DictionaryEntry
}

export function isCommonGroundingTerm(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (COMMON_WORDS.has(trimmed)) return true
  if (trimmed.length === 1 && COMMON_SINGLE_CHARS.has(trimmed)) return true
  return false
}

export function scoreGroundingMatch(
  segmentText: string,
  entry: DictionaryEntry,
): number {
  let score = segmentText.length * 10

  if (segmentText.length >= 3) score += 20
  if (segmentText.length === 2) score += 8
  if (entry.definitions.length > 2) score += 4

  const definitionText = entry.definitions.join(' ').toLowerCase()
  if (definitionText.includes('capital of') || definitionText.includes('province')) {
    score += 12
  }
  if (
    definitionText.includes('surname') &&
    segmentText.length === 1
  ) {
    score -= 8
  }

  return score
}

export function curateDictionaryMatches(
  candidates: GroundingMatchCandidate[],
): DictionaryEntry[] {
  const ranked = [...candidates].sort((left, right) => {
    const scoreDelta =
      scoreGroundingMatch(right.segmentText, right.entry) -
      scoreGroundingMatch(left.segmentText, left.entry)
    if (scoreDelta !== 0) return scoreDelta
    return left.position - right.position
  })

  const curated: DictionaryEntry[] = []
  const seenSimplified = new Set<string>()

  for (const candidate of ranked) {
    if (curated.length >= MAX_CURATED_MATCHES) break
    if (seenSimplified.has(candidate.entry.simplified)) continue
    seenSimplified.add(candidate.entry.simplified)
    curated.push(candidate.entry)
  }

  return curated
}

export function getVisibleGroundingEntries(
  entries: DictionaryEntry[],
  expanded: boolean,
  previewCount = GROUNDING_PREVIEW_COUNT,
): DictionaryEntry[] {
  if (expanded || entries.length <= previewCount) return entries
  return entries.slice(0, previewCount)
}
