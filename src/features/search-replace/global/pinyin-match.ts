/**
 * 中文拼音首字母与全拼检索接口模块
 * 支持拼音首字母匹配 (如 sz -> 深圳, cpjl -> 产品经理)
 * 支持全拼匹配 (如 shenzhen -> 深圳, siyuan -> 思源)
 * 支持多音字、连续匹配与高亮区间计算
 */
import {
  getCharPinyinInitial,
  matchAllPinyinRanges,
  matchPinyinRange,
} from './pinyin/engine'

export interface PinyinMatchResult {
  start: number
  end: number
  matchedText: string
}

/**
 * 获取单个字符的首字母
 */
export function getCharFirstLetter(ch: string): string {
  return getCharPinyinInitial(ch)
}

/**
 * 获取字符串的拼音首字母缩写
 * 例如 "产品经理" -> "cpjl", "深圳" -> "sz"
 */
export function getPinyinInitials(str: string): string {
  if (!str) return ''
  let res = ''
  for (let i = 0; i < str.length; i++) {
    res += getCharFirstLetter(str[i])
  }
  return res
}

/**
 * 通用拼音匹配（首字母 + 全拼 + 文本混合匹配）
 * 返回命中的文本起止范围 [start, end) 与 matchedText，或者 null
 */
export function matchPinyin(
  text: string,
  query: string,
): PinyinMatchResult | null {
  const q = query.trim()
  if (!q || !text) return null

  const range = matchPinyinRange(text, q)
  if (!range) return null

  const [startIndex, endIndex] = range
  const start = startIndex
  const end = endIndex + 1
  return {
    start,
    end,
    matchedText: text.slice(start, end),
  }
}

/**
 * 拼音首字母匹配检查 (兼容历史 API)
 */
export function matchPinyinInitials(
  text: string,
  query: string,
): PinyinMatchResult | null {
  return matchPinyin(text, query)
}

/**
 * 全拼模糊匹配检查 (兼容历史 API)
 */
export function matchFullPinyin(
  text: string,
  query: string,
): PinyinMatchResult | null {
  return matchPinyin(text, query)
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
