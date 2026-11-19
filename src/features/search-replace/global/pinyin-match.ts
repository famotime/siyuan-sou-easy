/**
 * 中文拼音首字母与全拼检索接口模块
 * 支持拼音首字母匹配 (如 sz -> 深圳, cpjl -> 产品经理)
 * 支持全拼匹配 (如 shenzhen -> 深圳, siyuan -> 思源)
 * 支持多音字、连续匹配与高亮区间计算
 */
import { matchAllPinyinRanges } from './pinyin/engine'

export interface PinyinMatchResult {
  start: number
  end: number
  matchedText: string
}

/**
 * 查找文本中全部拼音匹配项
 * 返回所有的匹配区间 [start, end) 及 matchedText
 */
export function findAllPinyinMatches(
  text: string,
  query: string,
): PinyinMatchResult[] {
  const q = query.trim()
  if (!q || !text) return []

  const ranges = matchAllPinyinRanges(text, q)
  return ranges.map(([startIndex, endIndex]) => {
    const start = startIndex
    const end = endIndex + 1
    return {
      start,
      end,
      matchedText: text.slice(start, end),
    }
  })
}
